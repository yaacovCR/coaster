'use strict';

module.exports = function(clients) {

  var Study = clients.mongoose.model('Study');
  var disallow = require('../common/allowMethods.middleware')();
  var authenticate = require('../common/jwt.wrapper')(clients.redis);
  var createError = require('http-errors');
  var _ = require('lodash');
  
  function passToElastic(req, res, next) {
    if (req.params.id) { return next(); }
    if (!req.query.distinct) { return next(createError(405, 'Simple queries not supported; search instead.')); }
    Study.search(null, {
      size: 0,
      aggs: { uniqueValues: { terms: { field: req.query.distinct } } }
    }, function(err, results) {
      if (err) { return next(err); }
      // Adapted from:
      // http://stackoverflow.com/questions/26221730/prefer-uppercase-unique-when-doing-case-insensitive-sort-removing-duplicates-ins
      var values = _.map(results.aggregations.uniqueValues.buckets, 'key');
      var sortedValues = values.sort(function(a, b) {
        return b.localeCompare(a, { sensitivity: 'base' });
      });
      var uniqueValues = _.sortedUniqBy(sortedValues, function(i) {
        return i.toLowerCase();
      });
      res.json(uniqueValues.sort(function(a, b) {
        return a.localeCompare(b, { sensitivity: 'base' });
      }));
    });
  }
    
  var options = {
    name: 'studies',
    preCreate: [ disallow ],
    preRead: [ authenticate, passToElastic ],
    preUpdate: [ disallow ],
    preRemove: [ disallow ],
  };  
    
  return options;
  
};