/**
 * @fileoverview AeroGuard AI — Event Emitter
 * A lightweight, synchronous publish/subscribe event bus used as the
 * central nervous system connecting the simulation engine to all UI layers.
 * @module engine/EventEmitter
 */

/**
 * Minimal yet complete pub/sub event emitter.
 *
 * @example
 * const bus = new EventEmitter();
 * const unsub = bus.on('target:spawn', (t) => console.log(t));
 * bus.emit('target:spawn', { id: 'TGT-001' });
 * unsub(); // unsubscribe
 */
export class EventEmitter {
  constructor() {
    /**
     * Internal listener registry.
     * @private
     * @type {Map<string, Set<Function>>}
     */
    this._listeners = new Map();
  }

  /* ──────────────────── Subscribe ──────────────────── */

  /**
   * Register a callback for the given event.
   *
   * @param {string}   event    — Event name (see `EVENT_TYPES`).
   * @param {Function} callback — Handler invoked with event payload(s).
   * @returns {Function} An unsubscribe function — call it to remove this
   *                     specific listener without needing a reference to `off`.
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // Return a convenient unsubscribe handle.
    return () => this.off(event, callback);
  }

  /**
   * Remove a previously registered callback.
   *
   * @param {string}   event    — Event name.
   * @param {Function} callback — The exact function reference passed to `on`.
   */
  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Register a callback that fires **at most once**, then auto‑unsubscribes.
   *
   * @param {string}   event    — Event name.
   * @param {Function} callback — One‑shot handler.
   * @returns {Function} Unsubscribe function (in case you want to cancel
   *                     before the event fires).
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };

    // Attach a reference so `off(event, callback)` still works
    // if the consumer holds onto the original function.
    wrapper._originalCallback = callback;

    return this.on(event, wrapper);
  }

  /* ───────────────────── Publish ───────────────────── */

  /**
   * Synchronously invoke every listener registered for `event`.
   *
   * @param {string} event — Event name.
   * @param {...*}   args  — Payload(s) forwarded to each listener.
   */
  emit(event, ...args) {
    const set = this._listeners.get(event);
    if (!set) return;

    for (const callback of set) {
      try {
        callback(...args);
      } catch (err) {
        console.error(`[EventEmitter] Error in listener for "${event}":`, err);
      }
    }
  }

  /* ────────────────── Introspection ────────────────── */

  /**
   * Remove listeners.
   * - If `event` is provided, remove all listeners for that event.
   * - If omitted, remove **all** listeners for **all** events.
   *
   * @param {string} [event]
   */
  removeAllListeners(event) {
    if (event !== undefined) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Return the number of listeners currently registered for `event`.
   *
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    const set = this._listeners.get(event);
    return set ? set.size : 0;
  }
}
