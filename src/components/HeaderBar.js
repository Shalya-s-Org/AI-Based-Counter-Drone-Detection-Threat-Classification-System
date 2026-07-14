import { THREAT_LEVELS } from '../utils/constants.js';

export default class HeaderBar {
  constructor(container, eventEmitter) {
    this._container = container;
    this._emitter = eventEmitter;
    this._el = {};
  }

  render() {
    this._container.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'header-bar';

    bar.innerHTML = `
      <div class="header-brand">
        <div class="header-logo-icon">&#x1F6E1;</div>
        <div>
          <div class="header-title">AeroGuard AI</div>
          <div class="header-subtitle">Counter-UAS Operations Dashboard</div>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat-badge">
          <div>
            <div class="stat-value" id="stat-fps">0</div>
            <div class="stat-label">FPS</div>
          </div>
        </div>
        <div class="stat-badge">
          <div>
            <div class="stat-value" id="stat-targets">0</div>
            <div class="stat-label">Targets</div>
          </div>
        </div>
        <div class="stat-badge">
          <div>
            <div class="stat-value" id="stat-threat">--</div>
            <div class="stat-label">Max Threat</div>
          </div>
        </div>
        <div class="stat-badge">
          <div>
            <div class="stat-value" id="stat-elapsed">00:00</div>
            <div class="stat-label">Uptime</div>
          </div>
        </div>
      </div>
      <div class="system-status">
        <div class="status-dot" id="system-status-dot"></div>
        <span id="system-status-text">Initializing...</span>
      </div>
    `;

    this._container.appendChild(bar);

    this._el.fps = bar.querySelector('#stat-fps');
    this._el.targets = bar.querySelector('#stat-targets');
    this._el.threat = bar.querySelector('#stat-threat');
    this._el.elapsed = bar.querySelector('#stat-elapsed');
    this._el.statusDot = bar.querySelector('#system-status-dot');
    this._el.statusText = bar.querySelector('#system-status-text');
  }

  updateStats(stats) {
    if (this._el.fps) this._el.fps.textContent = stats.fps ?? 0;
    if (this._el.targets) this._el.targets.textContent = stats.targetCount ?? 0;

    const elapsed = stats.elapsed ?? 0;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    if (this._el.elapsed) {
      this._el.elapsed.textContent =
        String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    if (stats.running) {
      if (this._el.statusDot) {
        this._el.statusDot.classList.remove('error');
      }
      if (this._el.statusText) {
        this._el.statusText.textContent = stats.paused ? 'PAUSED' : 'ONLINE';
      }
    } else {
      if (this._el.statusDot) {
        this._el.statusDot.classList.add('error');
      }
      if (this._el.statusText) {
        this._el.statusText.textContent = 'OFFLINE';
      }
    }
  }

  updateMaxThreat(level) {
    if (!this._el.threat) return;
    const def = THREAT_LEVELS[level];
    if (def) {
      this._el.threat.textContent = def.label;
      this._el.threat.style.color = def.color;
    }
  }
}
