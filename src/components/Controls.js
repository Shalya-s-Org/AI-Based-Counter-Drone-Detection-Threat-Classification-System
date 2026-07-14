import { COUNTERMEASURE_TYPES, EVENT_TYPES, TARGET_STATUSES } from '../utils/constants.js';
import audio from '../utils/audio.js';

export default class Controls {
  constructor(container, eventEmitter, targetManager) {
    this._container = container;
    this._emitter = eventEmitter;
    this._targetManager = targetManager;
    this._selectedTargetId = null;
    this._cooldowns = {};

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this._container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'controls-header';
    header.innerHTML = `
      <div class="controls-title">Countermeasures</div>
      <div class="selected-target-info" id="selected-target-info">No target selected</div>
    `;

    this._grid = document.createElement('div');
    this._grid.className = 'countermeasure-grid';

    this._buttons = {};
    for (const [key, def] of Object.entries(COUNTERMEASURE_TYPES)) {
      const btn = document.createElement('button');
      btn.className = `cm-button ${key.toLowerCase()}`;
      btn.dataset.type = key;
      btn.innerHTML = `
        <div class="cm-button-icon">&#x1F6F1;</div>
        <div class="cm-button-label">${def.label}</div>
        <div class="cm-button-status" id="cm-status-${key}">Ready</div>
        <div class="cooldown-bar" id="cm-bar-${key}" style="width: 0%"></div>
      `;
      btn.addEventListener('click', () => this.activate(key));
      this._grid.appendChild(btn);
      this._buttons[key] = btn;
    }

    const audioRow = document.createElement('div');
    audioRow.className = 'audio-toggle';
    audioRow.innerHTML = `
      <span>Audio Alerts</span>
      <div class="toggle-switch active" id="audio-toggle"></div>
    `;
    audioRow.querySelector('#audio-toggle').addEventListener('click', () => {
      const sw = audioRow.querySelector('#audio-toggle');
      const muted = audio.toggleMute();
      sw.classList.toggle('active', !muted);
    });

    this._container.appendChild(header);
    this._container.appendChild(this._grid);
    this._container.appendChild(audioRow);

    this._elInfo = header.querySelector('#selected-target-info');
  }

  _bindEvents() {
    this._emitter.on(EVENT_TYPES.COUNTERMEASURE_STATUS, (cooldowns) => {
      this._cooldowns = cooldowns;
      this._updateUI();
    });

    this._emitter.on(EVENT_TYPES.TARGET_SELECT, ({ targetId }) => {
      this._selectedTargetId = targetId;
      this._updateUI();
    });

    this._emitter.on(EVENT_TYPES.TARGET_DESTROY, (target) => {
      if (this._selectedTargetId === target.id) {
        this._selectedTargetId = null;
        this._updateUI();
      }
    });
  }

  activate(typeKey) {
    const targetId = this._selectedTargetId;
    const def = COUNTERMEASURE_TYPES[typeKey];

    if (typeKey !== 'ALARM' && !targetId) {
      this._emitter.emit(EVENT_TYPES.ALERT_LOG, {
        level: 'WARNING',
        message: 'Select a target first',
        timestamp: Date.now(),
      });
      return;
    }

    const target = targetId ? this._targetManager.getTarget(targetId) : null;
    if (typeKey !== 'ALARM' && target && target.status === TARGET_STATUSES.DESTROYED) {
      return;
    }

    const activated = this._emitter.emit(EVENT_TYPES.COUNTERMEASURE_ACTIVATE, {
      type: typeKey,
      targetId,
    });

    audio.playCountermeasure(typeKey);
  }

  setSelectedTarget(targetId) {
    this._selectedTargetId = targetId;
    this._updateUI();
  }

  _updateUI() {
    if (this._selectedTargetId) {
      this._elInfo.textContent = 'Selected: ' + this._selectedTargetId;
    } else {
      this._elInfo.textContent = 'No target selected';
    }

    for (const [key, btn] of Object.entries(this._buttons)) {
      const status = this._cooldowns[key];
      const statusEl = btn.querySelector(`#cm-status-${key}`);
      const barEl = btn.querySelector(`#cm-bar-${key}`);

      if (!status) {
        btn.disabled = key !== 'ALARM' && !this._selectedTargetId;
        if (statusEl) statusEl.textContent = 'Ready';
        if (barEl) barEl.style.width = '0%';
        continue;
      }

      btn.disabled = true;
      if (status.active) {
        if (statusEl) statusEl.textContent = 'Active';
        if (barEl) barEl.style.width = (status.progress * 100) + '%';
      } else {
        if (statusEl) statusEl.textContent = 'Cooldown ' + Math.ceil(status.cooldownRemaining / 1000) + 's';
        if (barEl) barEl.style.width = ((1 - status.progress) * 100) + '%';
      }
    }
  }

  render() {
    this._updateUI();
  }

  destroy() {
    this._container.innerHTML = '';
  }
}
