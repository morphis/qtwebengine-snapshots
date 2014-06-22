// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Parses gesture events in the Linux event trace format.
 */
base.require('tracing.importer.linux_perf.parser');
base.exportTo('tracing.importer.linux_perf', function() {

  var Parser = tracing.importer.linux_perf.Parser;

  /**
   * Parses trace events generated by gesture library for touchpad.
   * @constructor
   */
  function GestureParser(importer) {
    Parser.call(this, importer);
    importer.registerEventHandler('tracing_mark_write:log',
        GestureParser.prototype.logEvent.bind(this));
    importer.registerEventHandler('tracing_mark_write:SyncInterpret',
        GestureParser.prototype.syncEvent.bind(this));
    importer.registerEventHandler('tracing_mark_write:HandleTimer',
        GestureParser.prototype.timerEvent.bind(this));
  }

  GestureParser.prototype = {
    __proto__: Parser.prototype,

    /**
     * Parse events generate by gesture library.
     * gestureOpenSlice and gestureCloseSlice are two common
     * functions to store the begin time and end time for all
     * events in gesture library
     */
    gestureOpenSlice: function(title, ts, opt_args) {
      var thread = this.importer.getOrCreatePseudoThread('gesture').thread;
      thread.sliceGroup.beginSlice(
          'touchpad_gesture', title, ts, opt_args);
    },

    gestureCloseSlice: function(title, ts) {
      var thread = this.importer.getOrCreatePseudoThread('gesture').thread;
      if (thread.sliceGroup.openSliceCount) {
        var slice = thread.sliceGroup.mostRecentlyOpenedPartialSlice;
        if (slice.title != title) {
          this.importer.model.importWarning({
            type: 'title_match_error',
            message: 'Titles do not match. Title is ' +
                slice.title + ' in openSlice, and is ' +
                title + ' in endSlice'
          });
        } else {
          thread.sliceGroup.endSlice(ts);
        }
      }
    },

    /**
     * For log events, events will come in pairs with a tag log:
     * like this:
     * tracing_mark_write: log: start: TimerLogOutputs
     * tracing_mark_write: log: end: TimerLogOutputs
     * which represent the start and the end time of certain log behavior
     * Take these logs above for example, they are the start and end time
     * of logging Output for HandleTimer function
     */
    logEvent: function(eventName, cpuNumber, pid, ts, eventBase) {
      var innerEvent =
          /^\s*(\w+):\s*(\w+)$/.exec(eventBase.details);
      switch (innerEvent[1]) {
        case 'start':
          this.gestureOpenSlice('GestureLog', ts, {name: innerEvent[2]});
          break;
        case 'end':
          this.gestureCloseSlice('GestureLog', ts);
      }
      return true;
    },

    /**
     * For SyncInterpret events, events will come in pairs with
     * a tag SyncInterpret:
     * like this:
     * tracing_mark_write: SyncInterpret: start: ClickWiggleFilterInterpreter
     * tracing_mark_write: SyncInterpret: end: ClickWiggleFilterInterpreter
     * which represent the start and the end time of SyncInterpret function
     * inside the certain interpreter in the gesture library.
     * Take the logs above for example, they are the start and end time
     * of the SyncInterpret function inside ClickWiggleFilterInterpreter
     */
    syncEvent: function(eventName, cpuNumber, pid, ts, eventBase) {
      var innerEvent = /^\s*(\w+):\s*(\w+)$/.exec(eventBase.details);
      switch (innerEvent[1]) {
        case 'start':
          this.gestureOpenSlice('SyncInterpret', ts,
                                {interpreter: innerEvent[2]});
          break;
        case 'end':
          this.gestureCloseSlice('SyncInterpret', ts);
      }
      return true;
    },

    /**
     * For HandleTimer events, events will come in pairs with
     * a tag HandleTimer:
     * like this:
     * tracing_mark_write: HandleTimer: start: LookaheadFilterInterpreter
     * tracing_mark_write: HandleTimer: end: LookaheadFilterInterpreter
     * which represent the start and the end time of HandleTimer function
     * inside the certain interpreter in the gesture library.
     * Take the logs above for example, they are the start and end time
     * of the HandleTimer function inside LookaheadFilterInterpreter
     */
    timerEvent: function(eventName, cpuNumber, pid, ts, eventBase) {
      var innerEvent = /^\s*(\w+):\s*(\w+)$/.exec(eventBase.details);
      switch (innerEvent[1]) {
        case 'start':
          this.gestureOpenSlice('HandleTimer', ts,
                                {interpreter: innerEvent[2]});
          break;
        case 'end':
          this.gestureCloseSlice('HandleTimer', ts);
      }
      return true;
    }
  };

  Parser.registerSubtype(GestureParser);

  return {
    GestureParser: GestureParser
  };
});
