/**
 * AeroGuard AI — EventEmitter
 * Central pub/sub event bus for inter-module communication.
 */

export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Set<Function>} */
    this._wildcardListeners = new Set();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name, or '*' for all events
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (event === '*') {
      this._wildcardListeners.add(callback);
      return () => this._wildcardListeners.delete(callback);
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (event === '*') {
      this._wildcardListeners.delete(callback);
      return;
    }

    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Subscribe to an event once.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      callback(payload);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    // Notify specific listeners
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventEmitter] Error in listener for "${event}":`, err);
        }
      }
    }

    // Notify wildcard listeners
    for (const cb of this._wildcardListeners) {
      try {
        cb({ event, payload });
      } catch (err) {
        console.error(`[EventEmitter] Error in wildcard listener:`, err);
      }
    }
  }

  /**
   * Remove all listeners for an event, or all listeners entirely.
   * @param {string} [event]
   */
  removeAll(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
      this._wildcardListeners.clear();
    }
  }

  /**
   * Get listener count for debugging.
   * @param {string} [event]
   * @returns {number}
   */
  listenerCount(event) {
    if (event) {
      return (this._listeners.get(event)?.size || 0);
    }
    let count = this._wildcardListeners.size;
    for (const set of this._listeners.values()) {
      count += set.size;
    }
    return count;
  }
}
