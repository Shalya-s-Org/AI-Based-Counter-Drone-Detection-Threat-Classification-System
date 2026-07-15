/**
 * AeroGuard AI — AlertLog Component
 * Persistent scrollable event log with filtering.
 */

import { EVENTS } from '../utils/constants.js';
import { saveLog, getLogs } from '../utils/storage.js';

export class AlertLog {
  /**
   * @param {HTMLElement} container
   * @param {import('../engine/EventEmitter.js').EventEmitter} eventBus
   */
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.logs = [];
    this.maxDisplay = 50;

    this.init();
    this.bindEvents();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'alert-log-panel glass-panel';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.marginTop = '10px';
    this.el.style.flex = '1';
    this.el.style.minHeight = '0';

    this.el.innerHTML = `
      <div class="panel-header" style="padding: 8px 16px;">
        <span class="panel-title">Alert Log</span>
        <div class="panel-actions">
          <button class="panel-action-btn" id="btn-clear-log" title="Clear Logs">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
          <button class="panel-action-btn"><i data-lucide="more-horizontal" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="panel-content" style="padding: 4px 8px;">
        <div class="log-entries" id="log-entries"></div>
      </div>
    `;

    this.container.appendChild(this.el);
    this.logContainer = this.el.querySelector('#log-entries');

    // Clear button
    this.el.querySelector('#btn-clear-log').addEventListener('click', () => {
      import('../utils/storage.js').then((m) => m.clearLogs());
      this.logs = [];
      this.logContainer.innerHTML = '';
    });

    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });

    // Load persisted logs
    this.logs = getLogs();
    this._renderAll();
  }

  bindEvents() {
    this.eventBus.on(EVENTS.ALERT_LOG, (entry) => {
      this._addEntry(entry);
    });

    this.eventBus.on(EVENTS.THREAT_RECLASSIFY, ({ targetId, oldLevel, newLevel, score }) => {
      this._addEntry({
        level: newLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        message: `${targetId} reclassified: ${oldLevel} → ${newLevel} (score: ${score})`,
        timestamp: Date.now(),
        type: 'reclassify',
      });
    });
  }

  _addEntry(entry) {
    const log = {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
    };

    this.logs.push(log);

    // Persist
    saveLog(log);

    // Trim display
    if (this.logs.length > this.maxDisplay) {
      this.logs = this.logs.slice(-this.maxDisplay);
    }

    // Add to DOM
    const el = this._createLogElement(log);
    this.logContainer.insertBefore(el, this.logContainer.firstChild);

    // Trim DOM
    while (this.logContainer.children.length > this.maxDisplay) {
      this.logContainer.removeChild(this.logContainer.lastChild);
    }
  }

  _renderAll() {
    this.logContainer.innerHTML = '';
    const recentLogs = this.logs.slice(-this.maxDisplay).reverse();

    for (const log of recentLogs) {
      const el = this._createLogElement(log);
      this.logContainer.appendChild(el);
    }
  }

  _createLogElement(log) {
    const el = document.createElement('div');
    const levelClass = this._getLevelClass(log.level);
    el.className = `log-entry ${levelClass}`;

    const time = this._formatTimestamp(log.timestamp);
    const icon = this._getIcon(log.level);

    el.innerHTML = `
      <span class="log-timestamp">${time}</span>
      <span class="log-icon">${icon}</span>
      <span class="log-message">${log.message}</span>
    `;

    return el;
  }

  _formatTimestamp(ts) {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  _getLevelClass(level) {
    switch (level) {
      case 'CRITICAL': return 'critical';
      case 'WARNING': return 'warning';
      case 'LOW': return 'low';
      default: return 'info';
    }
  }

  _getIcon(level) {
    switch (level) {
      case 'CRITICAL': return '🔴';
      case 'WARNING': return '⚠️';
      case 'LOW': return '🔵';
      default: return 'ℹ️';
    }
  }

  destroy() {
    this.el.remove();
  }
}
