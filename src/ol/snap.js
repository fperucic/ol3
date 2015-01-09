goog.provide('ol.Snap');
goog.provide('ol.SnapEvent');
goog.provide('ol.SnapEventType');
goog.provide('ol.SnapProperty');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('ol.Collection');
goog.require('ol.CollectionEvent');
goog.require('ol.CollectionEventType');
goog.require('ol.Feature');
goog.require('ol.Object');
goog.require('ol.coordinate');
goog.require('ol.extent');
goog.require('ol.interaction.Pointer');
goog.require('ol.source.Vector');
goog.require('ol.source.VectorEvent');
goog.require('ol.source.VectorEventType');
goog.require('ol.structs.RBush');


/**
 * @enum {string}
 */
ol.SnapEventType = {
  /**
   * Triggered by the ol.interaction.Pointer
   * @event ol.SnapEventType#snapme
   * @api stable
   */
  SNAPME: 'snapme'
};



/**
 * @classdesc
 * Events emitted by {@link ol.interaction.Pointer} instances are instances of
 * this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {oli.SnapEvent}
 * @param {ol.SnapEventType} type Type.
 * @param {ol.Coordinate} coordinate The coordinate to be snapped.
 * @param {ol.Pixel} pixel Pixel of the coordinate to be snapped.
 * @param {ol.Map} map Map instance.
 */
ol.SnapEvent = function(type, coordinate, pixel, map) {

  goog.base(this, type);

  /**
   * The coordinate to be snapped.
   * @type {ol.Coordinate}
   */
  this.coordinate = coordinate;

  /**
   * Pixel of the coordinate to be snapped.
   * @type {ol.Pixel}
   */
  this.pixel = pixel;

  /**
   * Map of the event.
   * @type {ol.Map}
   */
  this.map = map;

  /**
   * The result of the snap.
   * @type {ol.Coordinate}
   * @api
   */
  this.snappedCoordinate = coordinate.slice();

  /**
   * The result of the snap.
   * @type {boolean}
   * @api
   */
  this.snapped = false;
};
goog.inherits(ol.SnapEvent, goog.events.Event);


/**
 * @enum {string}
 */
ol.SnapProperty = {
  SNAPPING: 'snapping'
};



/**
 * @classdesc
 * Helper class for providing snap in ol.interaction.Pointer.
 *
 * Example:
 *
 *     var snap = new ol.Snap({
 *       source: source,
 *       interactions: [
 *          modify, draw
 *       ]
 *     });
 *
 * @constructor
 * @extends {ol.Object}
 * @param {olx.SnapOptions=} opt_options Options.
 * @api
 */
ol.Snap = function(opt_options) {

  goog.base(this);

  var options = goog.isDef(opt_options) ? opt_options : {};

  var features;
  if (goog.isDef(options.source)) {
    features = options.source.getFeatures();
  }
  if (goog.isDef(options.features)) {
    features = options.features;
  }
  if (goog.isArray(features)) {
    features = new ol.Collection(features);
  }
  goog.asserts.assert(goog.isDef(features));

  /**
   * @type {Array.<ol.interaction.Pointer>}
   * @private
   */
  this.interactions_ = options.interactions;
  goog.asserts.assert(goog.isDef(this.interactions_));


  /**
   * @private
   * @type {Object.<string, goog.events.Key>}
   */
  this.interactionSnapListenerKeys_ = {};


  /**
   * @type {number}
   * @private
   */
  this.pixelTolerance_ = goog.isDef(options.pixelTolerance) ?
      options.pixelTolerance : 10;


  /**
  * Segment RTree for each layer
  * @type {Object.<*, ol.structs.RBush>}
  * @private
  */
  this.rBush_ = new ol.structs.RBush();


  /**
  * @const
  * @private
  * @type {Object.<string, function(ol.Feature, ol.geom.Geometry)> }
  */
  this.SEGMENT_WRITERS_ = {
    'Point': this.writePointGeometry_,
    'LineString': this.writeLineStringGeometry_,
    'LinearRing': this.writeLineStringGeometry_,
    'Polygon': this.writePolygonGeometry_,
    'MultiPoint': this.writeMultiPointGeometry_,
    'MultiLineString': this.writeMultiLineStringGeometry_,
    'MultiPolygon': this.writeMultiPolygonGeometry_,
    'GeometryCollection': this.writeGeometryCollectionGeometry_
  };


  features.forEach(this.addFeature, this);
  if (goog.isDef(options.source)) {
    goog.events.listen(options.source, ol.source.VectorEventType.ADDFEATURE,
        this.handleFeatureAdd_, false, this);
    goog.events.listen(options.source, ol.source.VectorEventType.REMOVEFEATURE,
        this.handleFeatureRemove_, false, this);
  } else if (goog.isDef(options.features)) {
    goog.events.listen(features, ol.CollectionEventType.ADD,
        this.handleFeatureAdd_, false, this);
    goog.events.listen(features, ol.CollectionEventType.REMOVE,
        this.handleFeatureRemove_, false, this);
  }

  this.setSnapping(goog.isDef(options.snapping) ? options.snapping : false);

};
goog.inherits(ol.Snap, ol.Object);


/**
 * @param {ol.Feature} feature Feature.
 * @api
 */
ol.Snap.prototype.addFeature = function(feature) {
  var geometry = feature.getGeometry();
  if (goog.isDef(this.SEGMENT_WRITERS_[geometry.getType()])) {
    this.SEGMENT_WRITERS_[geometry.getType()].call(this, feature, geometry);
  }
};
goog.exportProperty(
    ol.Snap.prototype,
    'addFeature',
    ol.Snap.prototype.addFeature);


/**
 * @param {ol.source.VectorEvent|ol.CollectionEvent} evt Event.
 * @private
 */
ol.Snap.prototype.handleFeatureAdd_ = function(evt) {
  var feature;
  if (evt instanceof ol.source.VectorEvent) {
    feature = evt.feature;
  } else if (evt instanceof ol.CollectionEvent) {
    feature = evt.element;
  }
  goog.asserts.assertInstanceof(feature, ol.Feature);
  this.addFeature(feature);
};


/**
 * @param {ol.source.VectorEvent|ol.CollectionEvent} evt Event.
 * @private
 */
ol.Snap.prototype.handleFeatureRemove_ = function(evt) {
  var feature;
  if (evt instanceof ol.source.VectorEvent) {
    feature = evt.feature;
  } else if (evt instanceof ol.CollectionEvent) {
    feature = evt.element;
  }
  goog.asserts.assertInstanceof(feature, ol.Feature);
  this.removeFeature(feature,
      feature.getGeometry().getExtent());
};


/**
 * @param {ol.SnapEvent} evt Event.
 * @private
 */
ol.Snap.prototype.handleSnapMeEvent_ = function(evt) {
  var result = this.snapTo(evt.pixel, evt.coordinate, evt.map);
  if (result.snapped) {
    evt.snappedCoordinate = result.vertex;
    evt.snapped = true;
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.Point} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writePointGeometry_ =
    function(feature, geometry) {
  var coordinates = geometry.getCoordinates();
  var segmentData = /** @type {ol.Snap.SegmentDataType} */ ({
    feature: feature,
    segment: [coordinates, coordinates]
  });
  this.rBush_.insert(geometry.getExtent(), segmentData);
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.MultiPoint} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writeMultiPointGeometry_ =
    function(feature, geometry) {
  var points = geometry.getCoordinates();
  var coordinates, i, ii, segmentData;
  for (i = 0, ii = points.length; i < ii; ++i) {
    coordinates = points[i];
    segmentData = /** @type {ol.Snap.SegmentDataType} */ ({
      feature: feature,
      segment: [coordinates, coordinates]
    });
    this.rBush_.insert(geometry.getExtent(), segmentData);
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.LineString} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writeLineStringGeometry_ =
    function(feature, geometry) {
  var coordinates = geometry.getCoordinates();
  var i, ii, segment, segmentData;
  for (i = 0, ii = coordinates.length - 1; i < ii; ++i) {
    segment = coordinates.slice(i, i + 2);
    segmentData = /** @type {ol.Snap.SegmentDataType} */ ({
      feature: feature,
      segment: segment
    });
    this.rBush_.insert(ol.extent.boundingExtent(segment), segmentData);
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.MultiLineString} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writeMultiLineStringGeometry_ =
    function(feature, geometry) {
  var lines = geometry.getCoordinates();
  var coordinates, i, ii, j, jj, segment, segmentData;
  for (j = 0, jj = lines.length; j < jj; ++j) {
    coordinates = lines[j];
    for (i = 0, ii = coordinates.length - 1; i < ii; ++i) {
      segment = coordinates.slice(i, i + 2);
      segmentData = /** @type {ol.Snap.SegmentDataType} */ ({
        feature: feature,
        segment: segment
      });
      this.rBush_.insert(ol.extent.boundingExtent(segment), segmentData);
    }
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.Polygon} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writePolygonGeometry_ =
    function(feature, geometry) {
  var rings = geometry.getCoordinates();
  var coordinates, i, ii, j, jj, segment, segmentData;
  for (j = 0, jj = rings.length; j < jj; ++j) {
    coordinates = rings[j];
    for (i = 0, ii = coordinates.length - 1; i < ii; ++i) {
      segment = coordinates.slice(i, i + 2);
      segmentData = /** @type {ol.Snap.SegmentDataType} */ ({
        feature: feature,
        segment: segment
      });
      this.rBush_.insert(ol.extent.boundingExtent(segment), segmentData);
    }
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.MultiPolygon} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writeMultiPolygonGeometry_ =
    function(feature, geometry) {
  var polygons = geometry.getCoordinates();
  var coordinates, i, ii, j, jj, k, kk, rings, segment, segmentData;
  for (k = 0, kk = polygons.length; k < kk; ++k) {
    rings = polygons[k];
    for (j = 0, jj = rings.length; j < jj; ++j) {
      coordinates = rings[j];
      for (i = 0, ii = coordinates.length - 1; i < ii; ++i) {
        segment = coordinates.slice(i, i + 2);
        segmentData = /** @type {ol.Snap.SegmentDataType} */ ({
          feature: feature,
          segment: segment
        });
        this.rBush_.insert(ol.extent.boundingExtent(segment), segmentData);
      }
    }
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.geom.GeometryCollection} geometry Geometry.
 * @private
 */
ol.Snap.prototype.writeGeometryCollectionGeometry_ =
    function(feature, geometry) {
  var i, geometries = geometry.getGeometriesArray();
  for (i = 0; i < geometries.length; ++i) {
    this.SEGMENT_WRITERS_[geometries[i].getType()].call(
        this, feature, geometries[i]);
  }
};


/**
 * @param {ol.Feature} feature Feature
 * @param {ol.Extent} extent Extent.
 * @api
 */
ol.Snap.prototype.removeFeature = function(feature, extent) {
  var rBush = this.rBush_;
  var i, nodesToRemove = [];
  rBush.forEachInExtent(extent, function(node) {
    if (feature === node.feature) {
      nodesToRemove.push(node);
    }
  });
  for (i = nodesToRemove.length - 1; i >= 0; --i) {
    rBush.remove(nodesToRemove[i]);
  }
};
goog.exportProperty(
    ol.Snap.prototype,
    'removeFeature',
    ol.Snap.prototype.removeFeature);


/**
 * @typedef {{snapped: {boolean},
 *    vertex: (ol.Coordinate|null)}}
 */
ol.SnapResultType;


/**
 * @param {ol.Pixel} pixel Pixel
 * @param {ol.Coordinate} pixelCoordinate Coordinate
 * @param {ol.Map} map Map.
 * @return {ol.SnapResultType} Snap result
 */
ol.Snap.prototype.snapTo = function(pixel, pixelCoordinate, map) {

  var lowerLeft = map.getCoordinateFromPixel(
      [pixel[0] - this.pixelTolerance_, pixel[1] + this.pixelTolerance_]);
  var upperRight = map.getCoordinateFromPixel(
      [pixel[0] + this.pixelTolerance_, pixel[1] - this.pixelTolerance_]);
  var box = ol.extent.boundingExtent([lowerLeft, upperRight]);

  var segments = this.rBush_.getInExtent(box);
  var snappedToVertex = false;
  var snapped = false;
  var vertex;
  if (segments.length > 0) {
    segments.sort(goog.partial(ol.Snap.sortByDistance, pixelCoordinate));
    var closestSegment = segments[0].segment;
    vertex = (ol.coordinate.closestOnSegment(pixelCoordinate,
        closestSegment));
    var vertexPixel = map.getPixelFromCoordinate(vertex);
    if (Math.sqrt(ol.coordinate.squaredDistance(pixel, vertexPixel)) <=
        this.pixelTolerance_) {
      snapped = true;
      var pixel1 = map.getPixelFromCoordinate(closestSegment[0]);
      var pixel2 = map.getPixelFromCoordinate(closestSegment[1]);
      var squaredDist1 = ol.coordinate.squaredDistance(vertexPixel, pixel1);
      var squaredDist2 = ol.coordinate.squaredDistance(vertexPixel, pixel2);
      var dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
      snappedToVertex = dist <= this.pixelTolerance_;
      if (snappedToVertex) {
        vertex = squaredDist1 > squaredDist2 ?
            closestSegment[1] : closestSegment[0];
      }
    }
  }
  return /** @type {ol.SnapResultType} */ ({
    snapped: snapped,
    vertex: vertex
  });
};


/**
 * Get the snapping property.
 * @return {boolean} snapping.
 * @observable
 * @api
 */
ol.Snap.prototype.getSnapping = function() {
  return  /** @type {boolean} */ (
      this.get(ol.SnapProperty.SNAPPING));
};


/**
 * Enable/disable snapping.
 * @param {boolean} snapping Whether to track SNAPME events on the interactions
 * @observable
 * @api stable
 */
ol.Snap.prototype.setSnapping = function(snapping) {

  goog.asserts.assertBoolean(snapping);

  for (var i = 0, len = this.interactions_.length; i < len; i++) {
    var interaction = this.interactions_[i];
    var key = goog.getUid(interaction).toString();
    var existing_listener = this.interactionSnapListenerKeys_[key];

    if (!existing_listener && snapping) {
      this.interactionSnapListenerKeys_[key] =
          goog.events.listen(interaction, ol.SnapEventType.SNAPME,
          this.handleSnapMeEvent_, false, this);
    } else if (existing_listener && !snapping) {
      goog.events.unlistenByKey(existing_listener);
      delete this.interactionSnapListenerKeys_[key];
    }
  }

  this.set(ol.SnapProperty.SNAPPING, snapping);
};
goog.exportProperty(
    ol.Snap.prototype,
    'setSnapping',
    ol.Snap.prototype.setSnapping);


/**
 * Sort segments by distance, helper function
 * @param {ol.Coordinate} pixelCoordinate Coordinate to determine distance
 * @param {ol.Snap.SegmentDataType} a
 * @param {ol.Snap.SegmentDataType} b
 * @return {number}
 */
ol.Snap.sortByDistance = function(pixelCoordinate, a, b) {
  return ol.coordinate.squaredDistanceToSegment(pixelCoordinate, a.segment) -
      ol.coordinate.squaredDistanceToSegment(pixelCoordinate, b.segment);
};


/**
 * @typedef {{feature: ol.Feature,
 *            segment: Array.<ol.Coordinate>}}
 */
ol.Snap.SegmentDataType;
