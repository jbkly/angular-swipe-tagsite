(function(window, angular, undefined) {

  'use strict';

  /* global -ngSwipe */

  var ngSwipe = angular.module('swipe', []);

  ngSwipe.factory('swipe', [ function() {

    var MOVE_BUFFER_RADIUS = 40;
    var MAX_RATIO = 0.3;

    var POINTER_EVENTS = {
      'mouse': {
        start: 'mousedown',
        move: 'mousemove',
        end: 'mouseup'
      },
      'touch': {
        start: 'touchstart',
        move: 'touchmove',
        end: 'touchend',
        cancel: 'touchcancel'
      }
    };

    function getCoordinates(event) {
      var originalEvent = event.originalEvent || event;
      var touches = originalEvent.touches && originalEvent.touches.length ? originalEvent.touches : [originalEvent];
      var e = (originalEvent.changedTouches && originalEvent.changedTouches[0]) || touches[0];

      return {
        x: e.clientX,
        y: e.clientY
      };
    }

    function getEvents(pointerTypes, eventType) {
      var res = [];
      angular.forEach(pointerTypes, function(pointerType) {
        var eventName = POINTER_EVENTS[pointerType][eventType];
        if (eventName) {
          res.push(eventName);
        }
      });
      return res.join(' ');
    }

    return {

      bind: function(element, eventHandlers, pointerTypes) {

        // Absolute total movement
        var totalX, totalY;
        // Coordinates of the start position.
        var startCoords;
        var lastPos;
        // Whether a swipe is active.
        var active = false;
        // Decide where we are going
        var isDecided = false;
        var isVertical = true;

        pointerTypes = pointerTypes || ['mouse', 'touch'];

        element.on(getEvents(pointerTypes, 'start'), function(event) {
          startCoords = getCoordinates(event);
          active = true;
          totalX = 0;
          totalY = 0;
          isDecided = false;
          isVertical = true;
          lastPos = startCoords;
          eventHandlers['start'] && eventHandlers['start'](startCoords, event);
        });

        element.on(getEvents(pointerTypes, 'cancel'), function(event) {
          active = false;
          eventHandlers['cancel'] && eventHandlers['cancel'](event);
        });

        element.on(getEvents(pointerTypes, 'move'), function(event) {

          if (! active) {
            return;
          }

          if (! startCoords) {
            return;
          }

          var coords = getCoordinates(event);

          totalX += Math.abs(coords.x - lastPos.x);
          totalY += Math.abs(coords.y - lastPos.y);

          lastPos = coords;

          if (totalX < MOVE_BUFFER_RADIUS && totalY < MOVE_BUFFER_RADIUS) {
            return;
          } else {
            if (! isDecided){

              var deltaX, deltaY, ratio;

              deltaX = Math.abs(coords.x - startCoords.x);
              deltaY = Math.abs(coords.y - startCoords.y);

              ratio = deltaY / deltaX;

              if (ratio < MAX_RATIO){
                // event.preventDefault();
                isVertical = false;
              } else {
                isVertical = true;
              }

              isDecided = true;
            }
          }

          event.isVertical = isVertical;
          eventHandlers['move'] && eventHandlers['move'](coords, event);
        });

        element.on(getEvents(pointerTypes, 'end'), function(event) {
          if (! active){
            return;
          }
          event.isVertical = isVertical;
          active = false;
          eventHandlers['end'] && eventHandlers['end'](getCoordinates(event), event);
        });
      }
    };
  }]);

  function makeSwipeDirective(directiveName, direction, axis, eventName) {
    ngSwipe.directive(directiveName, ['$parse', 'swipe', 'screenSize', function($parse, swipe, screenSize) {

      var MAX_OTHER_AXIS_DISTANCE = 75;
      var MAX_RATIO = 0.3;
      var MIN_DISTANCE = 30;

      return function(scope, element, attr) {

        var swipeHandler = $parse(attr[directiveName]);

        var startCoords, valid;

        function validSwipe(coords) {

          if (! startCoords || ! valid){
            return false;
          }

          var deltaY = (coords.y - startCoords.y) * direction;
          var deltaX = (coords.x - startCoords.x) * direction;

          if (! axis){  // horizontal swipe
            return Math.abs(deltaY) < MAX_OTHER_AXIS_DISTANCE &&
              deltaX > 0 &&
              deltaX > MIN_DISTANCE &&
              Math.abs(deltaY) / deltaX < MAX_RATIO;
          } else {  // vertical swipe
            return Math.abs(deltaX) < MAX_OTHER_AXIS_DISTANCE &&
              deltaY > 0 &&
              deltaY > MIN_DISTANCE &&
              Math.abs(deltaX) / deltaY < MAX_RATIO;
          }

        }

        var pointerTypes = ['touch'];

        if (!angular.isDefined(attr['ngSwipeDisableMouse'])) {
          pointerTypes.push('mouse');
        }

        function canScrollDown() {
          // get scroll distance between bottom of screen and bottom of section
          var section = angular.element('.pt-page-current');
          var sectionHeight = section[0].scrollHeight;
          var viewportHeight = angular.element('.pt-trigger-container').height();
          var scrollTop = section.scrollTop();
          var distanceFromBottom = sectionHeight - viewportHeight - scrollTop;
          if (distanceFromBottom > 0) {
            return true;
          }
          return false;
        }

        function canScrollUp() {
          // get scroll distance between top of screen and top of section
          var section = angular.element('.pt-page-current');
          var scrollTop = section.scrollTop();
          if (scrollTop > 0) {
            return true;
          }
          return false;
        }

        var atTopEdge = false;
        var atBottomEdge = false;

        swipe.bind(element, {
          'start': function(coords, event) {
            atTopEdge = !canScrollUp();
            atBottomEdge = !canScrollDown();
            var className = event.target.getAttribute('class');

            var targetAnchor = angular.element(event.target).is('a');
            var notNoPreventDefaultElement = className && className.match('noPreventDefault') === null;

            if (axis && ((! className || notNoPreventDefaultElement) && !targetAnchor)) {
              if (screenSize.is('desktop') && !(canScrollUp() || canScrollDown())) {
                // screenSize is desktop, prevent default swipe
                event.preventDefault ? event.preventDefault() : event.returnValue = false;
              }
            }
            startCoords = coords;
            valid = true;
          },
          'cancel': function() {
            valid = false;
          },
          'end': function(coords, event) {
            if (validSwipe(coords)) {

              if (eventName === 'swipeup' && !atBottomEdge) {
                // don't trigger swipe activity
                return;
              }

              if (eventName === 'swipedown' && !atTopEdge) {
                // don't trigger swipe activity
                return;
              }

              scope.$apply(function() {
                element.triggerHandler(eventName);
                swipeHandler(scope, { $event: event });
              });
            }
          }
        }, pointerTypes);
      };
    }]);
  }

  // avoid conflicts with ngTouch module

  try {
    angular.module('ngTouch');
  } catch(err) {
    makeSwipeDirective('ngSwipeLeft', -1, false, 'swipeleft');
    makeSwipeDirective('ngSwipeRight', 1, false, 'swiperight');
  }

  // left is negative x-coordinate, right is positive

  makeSwipeDirective('ngSwipeUp', -1, true, 'swipeup');
  makeSwipeDirective('ngSwipeDown', 1, true, 'swipedown');

})(window, window.angular);
