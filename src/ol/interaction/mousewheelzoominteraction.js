goog.provide('ol.interaction.MouseWheelZoom');

goog.require('goog.asserts');
goog.require('goog.events.MouseWheelEvent');
goog.require('goog.events.MouseWheelHandler.EventType');
goog.require('ol');
goog.require('ol.Coordinate');
goog.require('ol.ViewHint');
goog.require('ol.interaction.Interaction');
goog.require('ol.math');



/**
 * @classdesc
 * Allows the user to zoom the map by scrolling the mouse wheel.
 *
 * @constructor
 * @extends {ol.interaction.Interaction}
 * @param {olx.interaction.MouseWheelZoomOptions=} opt_options Options.
 * @api stable
 */
ol.interaction.MouseWheelZoom = function(opt_options) {

  goog.base(this, {
    handleEvent: ol.interaction.MouseWheelZoom.handleEvent
  });

  var options = opt_options || {};

  /**
   * @private
   * @type {number}
   */
  this.delta_ = 0;

  /**
   * @type {function(): undefined}
   * @private
   */
  this.doZoom_ = goog.bind(ol.interaction.MouseWheelZoom.doZoom, this);

  /**
   * @private
   * @type {number}
   */
  this.duration_ = options.duration !== undefined ? options.duration : 250;

  /**
   * @private
   * @type {boolean}
   */
  this.useAnchor_ = options.useAnchor !== undefined ? options.useAnchor : true;

  /**
   * @private
   * @type {?ol.Coordinate}
   */
  this.lastAnchor_ = null;

  /**
   * @private
   * @type {number|undefined}
   */
  this.startTime_ = undefined;

  /**
   * @private
   * @type {number|undefined}
   */
  this.timeoutId_ = undefined;

  /**
   * @private
   * @type {number|undefined}
   */
  this.wheelTimeout_ = options.wheelTimeout;

};
goog.inherits(ol.interaction.MouseWheelZoom, ol.interaction.Interaction);


/**
 * Handles the {@link ol.MapBrowserEvent map browser event} (if it was a
 * mousewheel-event) and eventually zooms the map.
 * @param {ol.MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} `false` to stop event propagation.
 * @this {ol.interaction.MouseWheelZoom}
 * @api
 */
ol.interaction.MouseWheelZoom.handleEvent = function(mapBrowserEvent) {
  var stopEvent = false;
  if (mapBrowserEvent.type ==
      goog.events.MouseWheelHandler.EventType.MOUSEWHEEL) {
    var mouseWheelEvent = mapBrowserEvent.browserEvent;
    goog.asserts.assertInstanceof(mouseWheelEvent, goog.events.MouseWheelEvent,
        'mouseWheelEvent should be of type MouseWheelEvent');

    if (this.useAnchor_) {
      this.lastAnchor_ = mapBrowserEvent.coordinate;
    }

    this.delta_ += mouseWheelEvent.deltaY;

    if (this.startTime_ === undefined) {
      this.startTime_ = Date.now();
    }

    var duration = this.wheelTimeout_ || ol.MOUSEWHEELZOOM_TIMEOUT_DURATION;
    var timeLeft = Math.max(duration - (Date.now() - this.startTime_), 0);

    goog.global.clearTimeout(this.timeoutId_);
    this.timeoutId_ = goog.global.setTimeout(this.doZoom_, timeLeft);

    mapBrowserEvent.preventDefault();
    stopEvent = true;
  }
  return !stopEvent;
};


/**
 * @this {ol.interaction.MouseWheelZoom}
 * @private
 */
ol.interaction.MouseWheelZoom.doZoom = function() {
  var map = this.getMap();
  var maxDelta = ol.MOUSEWHEELZOOM_MAXDELTA;
  var delta = ol.math.clamp(this.delta_, -maxDelta, maxDelta);

  var view = map.getView();
  goog.asserts.assert(!goog.isNull(view), 'view should not be null');

  ol.interaction.Interaction.zoomByDelta(map, view, -delta, this.lastAnchor_,
      this.duration_);

  this.delta_ = 0;
  this.lastAnchor_ = null;
  this.startTime_ = undefined;
  this.timeoutId_ = undefined;
};


/**
 * Enable or disable using the mouse's location as an anchor when zooming
 * @param {boolean} useAnchor true to zoom to the mouse's location, false
 * to zoom to the center of the map
 * @api
 */
ol.interaction.MouseWheelZoom.prototype.setMouseAnchor = function(useAnchor) {
  this.useAnchor_ = useAnchor;
  if (!useAnchor) {
    this.lastAnchor_ = null;
  }
};
