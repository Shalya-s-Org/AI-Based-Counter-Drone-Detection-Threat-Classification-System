/**
 * @fileoverview AeroGuard AI — LocalStorage Wrapper
 * Provides type‑safe JSON persistence, a FIFO‑pruned event log, and
 * graceful fallback when storage is unavailable (e.g. private browsing).
 * @module utils/storage
 */

/** Maximum number of log entries retained before FIFO pruning. */
const MAX_LOG_ENTRIES = 500;

/** Key under which the running event log is stored. */
const LOG_KEY = 'aeroguard_logs';

/**
 * Thin abstraction over `window.localStorage` with automatic
 * JSON serialisation/deserialisation and error handling.
 */
class StorageManager {
  /**
   * Persist a value under the given key.
   * @param {string} key   — Storage key.
   * @param {*}      data  — Any JSON‑serialisable value.
   */
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn(`[StorageManager] Failed to save key "${key}":`, err);
    }
  }

  /**
   * Retrieve a previously stored value.
   * @template T
   * @param {string} key          — Storage key.
   * @param {T}      [defaultValue=null] — Returned when the key is missing or corrupt.
   * @returns {T}
   */
  load(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[StorageManager] Failed to load key "${key}":`, err);
      return defaultValue;
    }
  }

  /**
   * Remove a single key from storage.
   * @param {string} key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[StorageManager] Failed to remove key "${key}":`, err);
    }
  }

  /**
   * Clear **all** keys managed by this application from storage.
   */
  clear() {
    try {
      localStorage.clear();
    } catch (err) {
      console.warn('[StorageManager] Failed to clear storage:', err);
    }
  }

  /* ───────────────────── Event Log Helpers ───────────────────── */

  /**
   * Append an entry to the persisted event log.
   * Automatically prunes the oldest entries when the log exceeds
   * {@link MAX_LOG_ENTRIES}.
   *
   * @param {Object} entry — Arbitrary log payload (should be JSON‑safe).
   */
  appendLog(entry) {
    const logs = this.getLogs();
    logs.push({
      ...entry,
      _ts: Date.now(),
    });

    // FIFO prune — keep only the most recent entries.
    while (logs.length > MAX_LOG_ENTRIES) {
      logs.shift();
    }

    this.save(LOG_KEY, logs);
  }

  /**
   * Return all persisted log entries, oldest first.
   * @returns {Object[]}
   */
  getLogs() {
    return this.load(LOG_KEY, []);
  }

  /**
   * Wipe the event log.
   */
  clearLogs() {
    this.remove(LOG_KEY);
  }
}

/**
 * Singleton instance shared across the application.
 * @type {StorageManager}
 */
const storage = new StorageManager();
export default storage;
export { StorageManager };
