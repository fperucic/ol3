goog.provide('ol.test');

describe('ol', function() {

  describe('ol.assert', function() {
    it('throws an exception', function() {
      expect(function() {
        ol.assert(false, 42);
      }).to.throwException();
    });
  });

  describe('ol.AssertionError', function() {
    it('generates a message', function() {
      var error = new ol.AssertionError(42);
      expect(error.message).to.be('Assertion failed. See /doc/errors/#42 for details.');
    });
    it('generates a message with a versioned url', function() {
      var origVersion = ol.VERSION;
      ol.VERSION = 'foo';
      var error = new ol.AssertionError(42);
      expect(error.message).to.be('Assertion failed. See http://openlayers.org/en/foo/doc/errors/#42 for details.');
      ol.VERSION = origVersion;
    });
    it('has an error code', function() {
      var error = new ol.AssertionError(42);
      expect(error.code).to.be(42);
    });
    it('has a name', function() {
      var error = new ol.AssertionError(42);
      expect(error.name).to.be('AssertionError');
    })
  });

});

goog.require('ol');
