/**
 * AeroGuard AI — ActiveTargets Component
 * Left sidebar with threat-sorted target cards.
 * Renders as a direct CSS Grid item with grid-area: sidebar.
 */

import { EVENTS, THREAT_LEVELS } from '../utils/constants.js';
import { playSelectSound } from '../utils/audio.js';

export class ActiveTargets {
  /**
   * @param {HTMLElement} container
   * @param {import('../engine/EventEmitter.js').EventEmitter} eventBus
   */
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.targets = [];
    this.selectedTargetId = null;

    this.init();
    this.bindEvents();
  }

  init() {
    // Single root element — direct child of .dashboard grid
    this.el = document.createElement('div');
    this.el.className = 'sidebar-panel glass-panel';
    this.el.style.gridArea = 'sidebar';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.overflow = 'hidden';

    this.el.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Active Targets</span>
        <div class="panel-actions">
          <button class="panel-action-btn"><i data-lucide="more-horizontal" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="panel-content" id="target-list-content" style="padding: 8px; gap: 8px; display: flex; flex-direction: column; overflow-y: auto; flex: 1; min-height: 0;"></div>
    `;

    this.container.appendChild(this.el);
    this.listContainer = this.el.querySelector('#target-list-content');

    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });
  }

  bindEvents() {
    this.eventBus.on(EVENTS.TARGET_UPDATE, ({ targets }) => {
      this.targets = targets;
      this._render();
    });

    this.eventBus.on(EVENTS.TARGET_SELECT, ({ targetId }) => {
      this.selectedTargetId = targetId;
      this._updateSelection();
    });
  }

  _render() {
    const cards = this.listContainer.querySelectorAll('.target-card');
    const targetIds = this.targets.map((t) => t.id);

    // Quick check: if same targets in same order, just update values
    const existingIds = Array.from(cards).map((c) => c.dataset.targetId);
    const sameOrder = targetIds.length === existingIds.length &&
      targetIds.every((id, i) => id === existingIds[i]);

    if (sameOrder) {
      this.targets.forEach((target, i) => {
        this._updateCard(cards[i], target);
      });
      return;
    }

    // Full re-render
    this.listContainer.innerHTML = '';

    for (const target of this.targets) {
      const card = this._createCard(target);
      this.listContainer.appendChild(card);
    }
  }

  _createCard(target) {
    const card = document.createElement('div');
    card.className = `glass-card target-card threat-${this._getThreatClass(target.threatLevel)}`;
    card.dataset.targetId = target.id;

    if (target.id === this.selectedTargetId) {
      card.classList.add('selected');
    }

    card.innerHTML = this._getCardHTML(target);

    card.addEventListener('click', () => {
      this.selectedTargetId = target.id;
      this.eventBus.emit(EVENTS.TARGET_SELECT, { targetId: target.id });
      playSelectSound();
    });

    return card;
  }

  _updateCard(card, target) {
    if (!card) return;

    card.className = `glass-card target-card threat-${this._getThreatClass(target.threatLevel)}`;
    if (target.id === this.selectedTargetId) {
      card.classList.add('selected');
    }

    card.innerHTML = this._getCardHTML(target);

    card.onclick = () => {
      this.selectedTargetId = target.id;
      this.eventBus.emit(EVENTS.TARGET_SELECT, { targetId: target.id });
      playSelectSound();
    };
  }

  _getCardHTML(target) {
    const eta = this._computeETA(target);
    const etaClass = target.threatLevel === 'CRITICAL' ? 'critical' : target.threatLevel === 'WARNING' ? 'warning' : '';

    return `
      <div class="target-card-header">
        <span class="target-card-id">${target.id}</span>
        <span class="status-badge ${this._getThreatClass(target.threatLevel)}">${this._getThreatDisplayName(target.threatLevel)}</span>
      </div>
      <div class="target-card-grid">
        <div class="target-card-stat">
          <span class="data-label">Speed</span>
          <span class="data-value">${target.speed.toFixed(1)}<span class="data-unit">m/s</span></span>
        </div>
        <div class="target-card-stat">
          <span class="data-label">Altitude</span>
          <span class="data-value">${Math.round(target.altitude)}<span class="data-unit">m</span></span>
        </div>
        <div class="target-card-stat">
          <span class="data-label">RCS</span>
          <span class="data-value">${target.rcs.toFixed(1)}<span class="data-unit">m²</span></span>
        </div>
      </div>
      <div class="target-card-grid" style="margin-top: 6px;">
        <div class="target-card-stat">
          <span class="data-label">Bearing</span>
          <span class="data-value">${Math.round((target.theta * 180 / Math.PI + 360) % 360)}°</span>
        </div>
        <div class="target-card-stat">
          <span class="data-label">Range</span>
          <span class="data-value">${Math.round(target.r)}<span class="data-unit">m</span></span>
        </div>
        <div class="target-card-stat">
          <span class="data-label">Score</span>
          <span class="data-value" style="color: ${target.threatColor || 'inherit'}">${target.threatScore}</span>
        </div>
      </div>
      <div class="target-card-footer">
        <div class="target-card-stat">
          <span class="data-label">Status</span>
          <span class="data-value text-sm">${target.status}</span>
        </div>
        <div class="target-card-eta ${etaClass}">
          <span>⏱ ${eta}</span>
        </div>
      </div>
    `;
  }

  _computeETA(target) {
    if (target.v >= -0.1) return '∞';
    const timeToCenter = Math.abs(target.r / target.v);
    if (timeToCenter > 3600) return '∞';
    const mins = Math.floor(timeToCenter / 60);
    const secs = Math.floor(timeToCenter % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:00`;
  }

  _getThreatClass(level) {
    switch (level) {
      case THREAT_LEVELS.CRITICAL: return 'critical';
      case THREAT_LEVELS.WARNING: return 'warning';
      case THREAT_LEVELS.LOW: return 'low';
      case THREAT_LEVELS.FALSE_POSITIVE: return 'false-positive';
      default: return 'low';
    }
  }

  _getThreatDisplayName(level) {
    switch (level) {
      case THREAT_LEVELS.CRITICAL: return 'Critical';
      case THREAT_LEVELS.WARNING: return 'Warning';
      case THREAT_LEVELS.LOW: return 'Low';
      case THREAT_LEVELS.FALSE_POSITIVE: return 'Safe';
      default: return level;
    }
  }

  _updateSelection() {
    const cards = this.listContainer.querySelectorAll('.target-card');
    cards.forEach((card) => {
      card.classList.toggle('selected', card.dataset.targetId === this.selectedTargetId);
    });
  }

  destroy() {
    this.el.remove();
  }
}
