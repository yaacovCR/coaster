'use strict';

module.exports = function(clients) {

  var limiter = require('express-limiter')(null, clients.redis);
  var passportWrapper = require('./passport.wrapper')(clients);
  var allowPatchOnly = require('../common/allowMethods.middleware')('PATCH');
  var sessionJoi = require('./session.joi.js');
  var contextFilter = require('../common/contextFilter.filter');
  var authenticate = require('../common/jwt.wrapper')(clients.redis);
  var allowAdminOnly = require('../common/allowAdminOnly.middleware');
  var authorize = require('../common/authorize.middleware');
  var createError = require('http-errors');

  var limiterWrapper = limiter({
    lookup: ['connection.remoteAddress'],
    onRateLimited: function (req, res, next) {
      next(createError(429, 'Too many tries'))
    },
    total: 10,
    expire: 1000 * 10
  });
  
  function updateTokens(req, res, next) {
    if (req.erm.result.state === 'open') {
      if (req.auth === undefined || req.auth.jti === req.params.id) {
        req.erm.result.generateJWT();
      }
    } else {
      req.erm.result.revoke();
    }
    next();
  }
  
  function revokeTokens(req, res, next) {
    req.erm.result.revoke();
    next();
  }
  
  var authorizeAccess = authorize(function(req) {
    return req.auth.hasAdminPrivileges || req.auth.jti === req.params.id;
  });

  var authorizeAdminUpdate = authorize(function(req) {
    return req.auth.hasAdminPrivileges || req.body.state.substr(0, 'admin'.length) !== 'admin';
  });
  
  function checkDocument(req, res, next) {
    if (req.erm.document.state !== 'open') {
      return next(createError(400, 'Only open sessions can be modified.'));
    }
    next();
  }  
  
  function updateTimestamps(req, res, next) {    
    if (req.body.state === 'open') {
      req.body.lastRefreshedAt = Date.now();
    } else {
      req.body.endedAt = Date.now();
    } 
    next();
  }

  var options = {
    name: 'sessions',
    preMiddleware: (process.env.NODE_ENV === 'development') ? [] : limiterWrapper,
    preCreate: [
      sessionJoi.validatePreCreate,
      passportWrapper.initialize(),
      passportWrapper.authenticate()
    ],
    postCreate: [ updateTokens ],
    contextFilter: contextFilter,
    preRead: [
      authenticate,
      authorizeAccess
    ],
    findOneAndUpdate: false,
    preUpdate: [
      authenticate,
      authorizeAccess,
      allowPatchOnly,
      sessionJoi.validatePreUpdate,
      authorizeAdminUpdate,
      checkDocument,
      updateTimestamps
    ],
    postUpdate: [ updateTokens ],
    preRemove: [
      authenticate,
      allowAdminOnly
    ],
    postRemove: [ revokeTokens ],
  };  
    
  return options;
  
};