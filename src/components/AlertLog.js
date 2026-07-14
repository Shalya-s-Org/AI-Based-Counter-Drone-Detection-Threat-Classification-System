import { EVENT_TYPES, THREAT_LEVELS } from '../utils/constants.js';

export default class AlertLog {
  constructor(container, eventEmitter) {
    this._container = container;
    this._emitter = eventEmitter;
    this._entries = [];
    this._filter = 'ALL';
    this._searchQuery = '';

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this._container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'log-header';
    header.innerHTML = `
      <div class="log-title">Alert Log</div>
      <div class="log-actions">
        <select class="glass-input" id="log-filter" style="width:auto;padding:4px 8px;font-size:11px;">
          <option value="ALL">All Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
          <option value="SUCCESS">Success</option>
        </select>
        <input type="text" class="glass-input" id="log-search" placeholder="Search..." style="width:120px;padding:4px 8px;font-size:11px;" />
        <button class="glass-button" id="log-clear" style="padding:4px 10px;font-size:11px;">Clear</button>
        <button class="glass-button" id="log-export" style="padding:4px 10px;font-size:11px;">Export CSV</button>
      </div>
    `;

    this._entriesEl = document.createElement('div');
    this._entriesEl.className = 'log-entries';

    this._empty = document.createElement('div');
    this._empty.className = 'log-empty';
    this._empty.textContent = 'No events yet';

    this._entriesEl.appendChild(this._empty);
    this._container.appendChild(header);
    this._container.appendChild(this._entriesEl);

    this._elFilter = header.querySelector('#log-filter');
    this._elSearch = header.querySelector('#log-search');

    this._elFilter.addEventListener('change', (e) => {
      this._filter = e.target.value;
      this._render();
    });

    this._elSearch.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase();
      this._render();
    });

    header.querySelector('#log-clear').addEventListener('click', () => {
      this._entries = [];
      this._render();
    });

    header.querySelector('#log-export').addEventListener('click', () => {
      this._exportCSV();
    });
  }

  _bindEvents() {
    this._emitter.on(EVENT_TYPES.ALERT_LOG, (entry) => {
      this.addEntry(entry);
    });

    this._emitter.on(EVENT_TYPES.TARGET_SPAWN, (target) => {
      this.addEntry({
        level: 'INFO',
        message: `Target ${target.id} detected`,
        targetId: target.id,
      });
    });

    this._emitter.on(EVENT_TYPES.TARGET_DESTROY, (target) => {
      this.addEntry({
        level: 'INFO',
        message: `Target ${target.id} removed`,
        targetId: target.id,
      });
    });
  }

  addEntry(entry) {
    this._entries.push({
      ...entry,
      timestamp: entry.timestamp || Date.now(),
    });
    if (this._entries.length > 500) {
      this._entries.shift();
    }
    this._render();
  }

  _render() {
    const frag = document.createDocumentFragment();
    let visible = 0;

    const icons = {
      CRITICAL: '&#x26A0;',
      WARNING: '&#x1F6A8;',
      INFO: '&#x2139;',
      SUCCESS: '&#x2705;',
    };

    for (const entry of this._entries) {
      if (this._filter !== 'ALL' && entry.level !== this._filter) continue;
      if (this._searchQuery && !entry.message.toLowerCase().includes(this._searchQuery)) continue;

      visible++;
      const el = document.createElement('div');
      el.className = 'log-entry ' + entry.level.toLowerCase();

      const date = new Date(entry.timestamp);
      const ts = date.toTimeString().slice(0, 8);

      el.innerHTML = `
        <div class="log-timestamp">${ts}</div>
        <div class="log-icon">${icons[entry.level] || '&#x2022;'}</div>
        <div class="log-message">${this._escapeHtml(entry.message)}</div>
      `;

      frag.appendChild(el);
    }

    this._entriesEl.innerHTML = '';
    if (visible === 0) {
      this._entriesEl.appendChild(this._empty);
    } else {
      this._entriesEl.appendChild(frag);
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _exportCSV() {
    const headers = ['Timestamp', 'Level', 'Message'];
    const rows = this._entries.map((entry) => {
      const date = new Date(entry.timestamp);
      const ts = date.toISOString();
      const escapedMessage = entry.message.replace(/"/g, '""');
      return [ts, entry.level, `"${escapedMessage}"`];
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alert-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  render() {
    this._render();
  }

  destroy() {
    this._container.innerHTML = '';
  }
}
