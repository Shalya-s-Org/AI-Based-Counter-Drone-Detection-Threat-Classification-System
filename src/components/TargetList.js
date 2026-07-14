import { THREAT_LEVELS, TARGET_STATUSES, EVENT_TYPES } from '../utils/constants.js';

export default class TargetList {
  constructor(container, eventEmitter) {
    this._container = container;
    this._emitter = eventEmitter;
    this._targets = new Map();
    this._filter = 'ALL';
    this._selectedTargetId = null;
    this._sortedIds = [];

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this._container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'target-list-header';
    header.innerHTML = `
      <div class="target-list-title">Active Targets</div>
      <div class="target-count" id="target-count">0 contacts</div>
    `;

    this._filters = document.createElement('div');
    this._filters.className = 'target-filters';

    const filters = ['ALL', 'CRITICAL', 'WARNING', 'LOW', 'FALSE_POSITIVE'];
    for (const f of filters) {
      const pill = document.createElement('button');
      pill.className = 'filter-pill' + (f === 'ALL' ? ' active' : '');
      pill.textContent = f === 'ALL' ? 'All' : THREAT_LEVELS[f]?.label || f;
      pill.dataset.filter = f;
      pill.addEventListener('click', () => this._setFilter(f));
      this._filters.appendChild(pill);
    }

    this._cards = document.createElement('div');
    this._cards.className = 'target-cards';

    this._container.appendChild(header);
    this._container.appendChild(this._filters);
    this._container.appendChild(this._cards);

    this._elCount = header.querySelector('#target-count');
  }

  _bindEvents() {
    this._emitter.on(EVENT_TYPES.TARGET_SPAWN, (target) => {
      this._targets.set(target.id, target);
      this._refresh();
    });

    this._emitter.on(EVENT_TYPES.TARGET_UPDATE, (targets) => {
      for (const t of targets) {
        this._targets.set(t.id, t);
      }
      this._refresh();
    });

    this._emitter.on(EVENT_TYPES.TARGET_DESTROY, (target) => {
      this._targets.delete(target.id);
      this._refresh();
    });

    this._emitter.on(EVENT_TYPES.TARGET_SELECT, ({ targetId }) => {
      this._selectedTargetId = targetId;
      this._refresh();
    });
  }

  _setFilter(filter) {
    this._filter = filter;
    for (const pill of this._filters.querySelectorAll('.filter-pill')) {
      pill.classList.toggle('active', pill.dataset.filter === filter);
    }
    this._refresh();
  }

  setSelectedTarget(targetId) {
    this._selectedTargetId = targetId;
    this._refresh();
  }

  _refresh() {
    let list = Array.from(this._targets.values());

    if (this._filter !== 'ALL') {
      list = list.filter((t) => t.threatLevel === this._filter);
    }

    const threatOrder = { CRITICAL: 0, WARNING: 1, LOW: 2, FALSE_POSITIVE: 3, null: 4 };
    list.sort((a, b) => (threatOrder[a.threatLevel] ?? 4) - (threatOrder[b.threatLevel] ?? 4));

    this._sortedIds = list.map((t) => t.id);
    this._elCount.textContent = list.length + ' contact' + (list.length !== 1 ? 's' : '');

    const existing = new Map();
    for (const card of this._cards.querySelectorAll('.target-card')) {
      existing.set(card.dataset.id, card);
    }

    const next = new Set(this._sortedIds);
    for (const id of existing.keys()) {
      if (!next.has(id)) {
        existing.get(id).remove();
      }
    }

    const frag = document.createDocumentFragment();
    for (const target of list) {
      let card = existing.get(target.id);
      if (!card) {
        card = document.createElement('div');
        card.className = 'target-card';
        card.dataset.id = target.id;
        card.addEventListener('click', () => {
          this._emitter.emit(EVENT_TYPES.TARGET_SELECT, { targetId: target.id });
        });
      }

      const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;
      const isSelected = this._selectedTargetId === target.id;

      card.className = 'target-card threat-' + (target.threatLevel?.toLowerCase() || 'false-positive');
      if (isSelected) card.classList.add('selected');

      card.innerHTML = `
        <div class="target-card-header">
          <div class="target-id">${target.id}</div>
          <div class="target-status-pill ${target.status.toLowerCase()}">${target.status}</div>
        </div>
        <div class="target-stats">
          <div class="target-stat">
            <div class="target-stat-label">Speed</div>
            <div class="target-stat-value">${Math.abs(target.v).toFixed(1)} m/s</div>
          </div>
          <div class="target-stat">
            <div class="target-stat-label">Altitude</div>
            <div class="target-stat-value">${target.altitude.toFixed(0)} m</div>
          </div>
          <div class="target-stat">
            <div class="target-stat-label">Threat</div>
            <div class="target-stat-value" style="color:${def.color}">${target.threatScore.toFixed(0)}</div>
          </div>
          <div class="target-stat">
            <div class="target-stat-label">RCS</div>
            <div class="target-stat-value">${target.rcs.toFixed(2)} m²</div>
          </div>
          <div class="target-stat">
            <div class="target-stat-label">Bearing</div>
            <div class="target-stat-value">${(target.theta * 180 / Math.PI % 360).toFixed(0)}°</div>
          </div>
          <div class="target-stat">
            <div class="target-stat-label">Range</div>
            <div class="target-stat-value">${target.r.toFixed(0)} m</div>
          </div>
        </div>
      `;

      frag.appendChild(card);
    }

    this._cards.appendChild(frag);
  }

  render() {
    this._refresh();
  }

  destroy() {
    this._container.innerHTML = '';
  }
}
