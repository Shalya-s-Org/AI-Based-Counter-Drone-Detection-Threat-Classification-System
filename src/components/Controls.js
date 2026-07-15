/**
 * AeroGuard AI — Controls Component
 * Quick Actions panel with 6 countermeasure buttons.
 */

import { EVENTS, COUNTERMEASURES } from '../utils/constants.js';
import { playCountermeasureSound } from '../utils/audio.js';

export class Controls {
  /**
   * @param {HTMLElement} container
   * @param {import('../engine/EventEmitter.js').EventEmitter} eventBus
   * @param {import('../engine/CountermeasureEngine.js').CountermeasureEngine} cmEngine
   */
  constructor(container, eventBus, cmEngine) {
    this.container = container;
    this.eventBus = eventBus;
    this.cmEngine = cmEngine;
    this.selectedTargetId = null;

    this.init();
    this.bindEvents();
    this._startUpdateLoop();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'controls-panel glass-panel';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';

    this.el.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Quick Actions</span>
        <div class="panel-actions">
          <button class="panel-action-btn"><i data-lucide="more-horizontal" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="panel-content" style="padding: 8px;">
        <div class="controls-grid" id="controls-grid"></div>
      </div>
    `;

    this.container.appendChild(this.el);
    this.gridEl = this.el.querySelector('#controls-grid');

    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });

    this._renderButtons();
  }

  _renderButtons() {
    this.gridEl.innerHTML = '';

    const cmList = Object.values(COUNTERMEASURES);

    for (const cm of cmList) {
      const btn = document.createElement('button');
      btn.className = 'cm-btn';
      btn.dataset.cmType = cm.id;
      btn.innerHTML = `
        <i data-lucide="${cm.icon}" style="width:20px;height:20px"></i>
        <span class="cm-name">${cm.name}</span>
        <span class="cm-cooldown">Cooldown: ${Math.round(cm.cooldown / 1000)}s</span>
      `;

      btn.addEventListener('click', () => this._onActivate(cm.id));
      this.gridEl.appendChild(btn);
    }

    if (window.lucide) window.lucide.createIcons({ nodes: [this.gridEl] });
  }

  bindEvents() {
    this.eventBus.on(EVENTS.TARGET_SELECT, ({ targetId }) => {
      this.selectedTargetId = targetId;
    });

    this.eventBus.on(EVENTS.COUNTERMEASURE_STATUS, () => {
      this._updateButtonStates();
    });
  }

  _onActivate(cmType) {
    const activeTargets = this.cmEngine.targetManager.getActiveTargets();
    let targetId = this.selectedTargetId;
    if (targetId && !this.cmEngine.targetManager.getTarget(targetId)) {
      targetId = null;
    }
    if (!targetId && activeTargets.length > 0) {
      targetId = activeTargets[0].id;
    }

    if (!targetId) {
      this.eventBus.emit(EVENTS.ALERT_LOG, {
        level: 'WARNING',
        message: 'No active threat target available for countermeasures',
        timestamp: Date.now(),
        type: 'system',
      });
      return;
    }

    if (this.cmEngine.isOnCooldown(cmType)) {
      return;
    }

    const success = this.cmEngine.activate(cmType, targetId);
    if (success) {
      playCountermeasureSound();
      this._updateButtonStates();
    }
  }

  _updateButtonStates() {
    const buttons = this.gridEl.querySelectorAll('.cm-btn');
    const activeTargets = this.cmEngine.targetManager.getActiveTargets();
    const hasTargets = activeTargets.length > 0;

    let targetId = this.selectedTargetId;
    if (targetId && !this.cmEngine.targetManager.getTarget(targetId)) {
      targetId = null;
    }
    if (!targetId && hasTargets) {
      targetId = activeTargets[0].id;
    }

    buttons.forEach((btn) => {
      const cmType = btn.dataset.cmType;
      const key = `${cmType}:${targetId}`;
      const cmInstance = targetId ? this.cmEngine.activeCountermeasures.get(key) : null;
      const isActive = !!cmInstance;
      const isOnCooldown = this.cmEngine.isOnCooldown(cmType);
      const cooldownRemaining = this.cmEngine.getCooldownRemaining(cmType);

      btn.classList.toggle('active', isActive);
      btn.classList.toggle('cooldown', isOnCooldown);
      btn.disabled = !hasTargets;
      btn.style.opacity = hasTargets ? '1' : '0.5';
      btn.style.cursor = hasTargets ? 'pointer' : 'not-allowed';

      const sublabel = btn.querySelector('.cm-cooldown');
      if (isActive) {
        sublabel.textContent = cmInstance.state || 'ACTIVE';
        sublabel.style.color = 'var(--accent-cyan)';
      } else if (isOnCooldown) {
        sublabel.textContent = `Cooldown: ${Math.ceil(cooldownRemaining / 1000)}s`;
        sublabel.style.color = 'var(--color-warning)';
      } else {
        const cm = COUNTERMEASURES[cmType];
        sublabel.textContent = `Cooldown: ${Math.round(cm.cooldown / 1000)}s`;
        sublabel.style.color = '';
      }
    });
  }

  _startUpdateLoop() {
    this._updateInterval = setInterval(() => this._updateButtonStates(), 250);
  }

  destroy() {
    clearInterval(this._updateInterval);
    this.el.remove();
  }
}
