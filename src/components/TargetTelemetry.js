/**
 * AeroGuard AI — TargetTelemetry Component
 * Detailed telemetry readout for the selected target.
 */

import { EVENTS } from '../utils/constants.js';

export class TargetTelemetry {
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
    this.el = document.createElement('div');
    this.el.className = 'telemetry-panel glass-panel';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';

    this.el.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Target Telemetry</span>
        <div class="panel-actions">
          <button class="panel-action-btn"><i data-lucide="more-horizontal" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="panel-content" id="telemetry-content" style="padding: 12px;"></div>
    `;

    this.container.appendChild(this.el);
    this.contentEl = this.el.querySelector('#telemetry-content');

    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });

    this._renderEmpty();
  }

  bindEvents() {
    this.eventBus.on(EVENTS.TARGET_UPDATE, ({ targets }) => {
      this.targets = targets;
      this._render();
    });

    this.eventBus.on(EVENTS.TARGET_SELECT, ({ targetId }) => {
      this.selectedTargetId = targetId;
      this._render();
    });
  }

  _render() {
    const target = this._getTarget();
    if (!target) {
      this._renderEmpty();
      return;
    }

    const bearing = Math.round(((target.theta * 180) / Math.PI + 360) % 360);
    const batteryEst = (13 + Math.random() * 2).toFixed(2);
    const signalStrength = Math.max(10, 100 - target.r / 10);

    this.contentEl.innerHTML = `
      <div class="telemetry-header">
        <span class="telemetry-target-id">${target.id}</span>
        <div class="telemetry-actions">
          <div class="telemetry-action-icon" title="Lock Camera">
            <i data-lucide="crosshair" style="width:16px;height:16px"></i>
          </div>
          <div class="telemetry-action-icon" title="Track">
            <i data-lucide="navigation" style="width:16px;height:16px"></i>
          </div>
          <div class="telemetry-action-icon" title="Details">
            <i data-lucide="info" style="width:16px;height:16px"></i>
          </div>
        </div>
      </div>

      <div class="telemetry-grid">
        <div class="telemetry-stat">
          <span class="data-label">Speed</span>
          <span class="data-value">${target.speed.toFixed(1)}<span class="data-unit">m/s</span></span>
        </div>
        <div class="telemetry-stat">
          <span class="data-label">Altitude</span>
          <span class="data-value">${Math.round(target.altitude)}<span class="data-unit">m</span></span>
        </div>
        <div class="telemetry-stat">
          <span class="data-label">RCS</span>
          <span class="data-value">${target.rcs.toFixed(1)}<span class="data-unit">m²</span></span>
        </div>
        <div class="telemetry-stat">
          <span class="data-label">Bearing</span>
          <span class="data-value">${bearing}°</span>
        </div>
      </div>

      <div class="telemetry-row">
        <div class="telemetry-stat">
          <span class="data-label">Lat/Long</span>
          <span class="data-value text-sm">${(22 + Math.random() * 0.1).toFixed(1)}° ${(33 + Math.random() * 0.1).toFixed(0)}'${(36 + Math.random() * 10).toFixed(0)}"</span>
        </div>
        <div class="telemetry-stat">
          <span class="data-label">Battery Est.</span>
          <span class="data-value text-sm" style="color: var(--color-false-positive)">${batteryEst}<span class="data-unit">m</span></span>
        </div>
        <div class="telemetry-stat">
          <span class="data-label">Battery Est.</span>
          <span class="data-value text-sm">—</span>
        </div>
        <div class="telemetry-stat">
          <span class="data-label">Payload Est.</span>
          <span class="data-value text-sm">—</span>
        </div>
      </div>

      <div class="signal-strength-container">
        <div>
          <span class="data-label">Last Seen</span>
          <span class="data-value text-sm font-mono" style="margin-left: 8px">${this._formatTime(target.lastUpdate)}</span>
        </div>
        <div style="text-align: right;">
          <span class="data-label">Signal Strength</span>
          <div class="signal-bars" style="margin-top: 4px; display: inline-flex; margin-left: 8px;">
            ${this._renderSignalBars(signalStrength)}
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ nodes: [this.contentEl] });
  }

  _renderEmpty() {
    this.contentEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: var(--font-size-sm);">
        Select a target to view telemetry
      </div>
    `;
  }

  _renderSignalBars(strength) {
    const barCount = 8;
    let html = '';
    for (let i = 0; i < barCount; i++) {
      const threshold = (i + 1) / barCount * 100;
      const active = strength >= threshold;
      const height = 6 + i * 3;
      const color = active
        ? (i < 3 ? 'var(--color-critical)' : i < 5 ? 'var(--color-warning)' : 'var(--color-false-positive)')
        : 'hsla(200, 20%, 25%, 0.4)';
      html += `<div class="signal-bar" style="height:${height}px;background:${color};"></div>`;
    }
    return html;
  }

  _getTarget() {
    if (!this.selectedTargetId) return this.targets[0] || null;
    return this.targets.find((t) => t.id === this.selectedTargetId) || null;
  }

  _formatTime(timestamp) {
    const d = new Date(timestamp);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} ${d.getSeconds().toString().padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0').slice(0, 4)}`;
  }

  destroy() {
    this.el.remove();
  }
}
