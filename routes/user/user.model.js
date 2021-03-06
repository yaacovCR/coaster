'use strict';

module.exports = function(clients) {

  var mongoose = require('mongoose');
  var crypto = require('crypto');
  var jwt = require('jsonwebtoken');
  var blacklist = require('../common/blacklist.wrapper')(clients.redis);
  var options = require('../common/options'); 
  var secondsToJwtExpiration = options.secondsToJwtExpiration;
  var allowedDomains = options.allowedDomains;
  
  var UserSchema = new mongoose.Schema({
    userName: { type: String, lowercase: true, unique: true, required: true },
    domain: { type: String, enum: allowedDomains, default: 'local' },
    isAdmin: { type: Boolean, default: false },
    activated: { type: Boolean, default: false },
    hash: { type: String },
    salt: { type: String }
  });

  UserSchema.virtual('password').set(setPassword);
  UserSchema.methods.matchesHash = matchesHash;
  UserSchema.methods.generateJWT = generateJWT;
  UserSchema.methods.purge = purge;
  UserSchema.methods.updateTokens = updateTokens;

  ['toJSON', 'toObject'].forEach(function (prop) {
    UserSchema.set(prop, {
      transform: function (doc, ret) {
        delete ret.hash;
        delete ret.salt;
      }
    });
  });

  return clients.mongoose.model('User', UserSchema);

  function setPassword(password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 100000, 64, 'sha512').toString('hex');
  }

  function matchesHash(password) {
    var hash = crypto.pbkdf2Sync(password, this.salt, 100000, 64, 'sha512').toString('hex');
    return this.hash === hash;
  }
  
  function generateJWT(sessionId) {
    this.set('token', jwt.sign({
      hasAdminPrivileges : this.isAdmin
    }, process.env.COASTER_JWT_SECRETKEY, {
      subject : this._id.toString(),
      jwtid: sessionId.toString(),
      expiresIn: secondsToJwtExpiration
    }), String, { strict: false });
  }
  
  function purge() {
    blacklist.purge({ sub: this._id }, secondsToJwtExpiration);
  }

  function updateTokens(sessionId) {
    this.purge();
    this.generateJWT(sessionId);
  }

}