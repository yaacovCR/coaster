/*global describe:false, it:false, expect:false*/

'use strict';

var request = require('request');

var app = require('../lib/app');
var config = require('../config');
var server = require('http').createServer(app);
var baseUrl = 'http://' + config.hostName + ':3000/dummy.html';

describe('unknown resource', function() {

  describe('app spinup', function() {
    it('should be ok', function(done) {
      server.listen(3000);
      server.on('listening', function() {
        done();
      });
    });
  });
    
  describe('POST /', function() {
    
    var requestOptions = {
      url: baseUrl,
      json: true
    };

    it('returns 301 as redirects to root', function(done) {
      request.post(requestOptions, function(error, response) {
        expect(response.statusCode).toBe(301);
        done();
      });      
    });
    
  });
  
  describe('app spindown', function() {
    it('should be ok', function(done) {
      server.close();
      done();
    });
  });
  
});