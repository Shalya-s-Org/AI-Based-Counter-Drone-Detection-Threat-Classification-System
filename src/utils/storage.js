/**
 * AeroGuard AI — LocalStorage Persistence
 * FIFO log storage with filtering and export.
 */

import { UI_CONFIG } from './constants.js';

const STORAGE_KEY = 'aeroguard_alert_logs';

/**
 * Save a log entry to LocalStorage with FIFO eviction.
 * @param {{ level: string, message: string, timestamp: number, type?: string }} entry
 */
export function saveLog(entry) {
  try {
    const logs = getLogs();
    logs.push({
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: entry.timestamp || Date.now(),
    });

    // FIFO: remove oldest if over limit
    while (logs.length > UI_CONFIG.logFifoSize) {
      logs.shift();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('[Storage] Failed to save log:', e.message);
  }
}

/**
 * Retrieve all logs, optionally filtered.
 * @param {{ level?: string, search?: string, since?: number }} filter
 * @returns {Array}
 */
export function getLogs(filter = {}) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let logs = raw ? JSON.parse(raw) : [];

    if (filter.level) {
      logs = logs.filter((l) => l.level === filter.level);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      logs = logs.filter((l) => l.message.toLowerCase().includes(q));
    }
    if (filter.since) {
      logs = logs.filter((l) => l.timestamp >= filter.since);
    }

    return logs;
  } catch (e) {
    console.warn('[Storage] Failed to read logs:', e.message);
    return [];
  }
}

/**
 * Clear all stored logs.
 */
export function clearLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[Storage] Failed to clear logs:', e.message);
  }
}

/**
 * Export logs in the specified format.
 * @param {'json' | 'csv'} format
 * @returns {string}
 */
export function exportLogs(format = 'json') {
  const logs = getLogs();

  if (format === 'csv') {
    const header = 'id,timestamp,level,type,message';
    const rows = logs.map(
      (l) =>
        `${l.id},${new Date(l.timestamp).toISOString()},${l.level},${l.type || ''},${l.message.replace(/,/g, ';')}`
    );
    return [header, ...rows].join('\n');
  }

  return JSON.stringify(logs, null, 2);
}

/**
 * Get log count.
 * @returns {number}
 */
export function getLogCount() {
  return getLogs().length;
}
