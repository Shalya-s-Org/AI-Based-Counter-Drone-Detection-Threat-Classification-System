/**
 * AeroGuard AI — HeaderBar Component
 * Top navigation bar with branding, system stats, and action buttons.
 * Renders as a direct CSS Grid item with grid-area: header.
 */

import { EVENTS } from '../utils/constants.js';

export class HeaderBar {
  /**
   * @param {HTMLElement} container
   * @param {import('../engine/EventEmitter.js').EventEmitter} eventBus
   */
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.targetCount = 0;
    this.criticalCount = 0;
    this.fps = 0;
    this.audioEnabled = true;

    this.init();
    this.bindEvents();
  }

  init() {
    this.el = document.createElement('header');
    this.el.className = 'header-bar';
    // This element is a direct child of .dashboard, so it uses grid-area
    this.el.style.gridArea = 'header';

    this.el.innerHTML = `
      <div class="header-brand">
        <svg class="header-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <h1 class="header-title">AeroGuard AI <span>Tactical Command V2</span></h1>
      </div>

      <div class="header-stats">
        <div class="header-stat">
          <span class="header-stat-value" id="stat-targets">0</span>
          <span class="header-stat-label">Targets</span>
        </div>
        <div class="header-stat">
          <span class="header-stat-value" id="stat-threats" style="color: var(--color-critical)">0</span>
          <span class="header-stat-label">Threats</span>
        </div>
        <div class="header-stat">
          <span class="header-stat-value" id="stat-fps">60</span>
          <span class="header-stat-label">FPS</span>
        </div>
        <div class="header-stat">
          <span class="header-stat-value font-mono" id="stat-time">00:00:00</span>
          <span class="header-stat-label">System Time</span>
        </div>
      </div>

      <div class="header-actions">
        <div class="dropdown" id="spawn-dropdown">
          <button class="header-action-btn" id="btn-spawn" title="Introduce Threat Target (Demo)" style="border-color: rgba(224, 55, 55, 0.4); color: rgba(224, 55, 55, 0.85);">
            <i data-lucide="plus-circle" style="width:18px;height:18px"></i>
          </button>
          <div class="dropdown-menu glass-panel" id="spawn-menu">
            <div class="dropdown-item" data-threat-level="RANDOM">
              <i data-lucide="shuffle" style="width:16px;height:16px;color:var(--text-secondary)"></i>
              <span>Random Target</span>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item threat-critical" data-threat-level="CRITICAL">
              <i data-lucide="shield-alert" style="width:16px;height:16px"></i>
              <span>Critical Threat</span>
            </div>
            <div class="dropdown-item threat-warning" data-threat-level="WARNING">
              <i data-lucide="alert-triangle" style="width:16px;height:16px"></i>
              <span>Warning Threat</span>
            </div>
            <div class="dropdown-item threat-low" data-threat-level="LOW">
              <i data-lucide="navigation" style="width:16px;height:16px"></i>
              <span>Low Threat</span>
            </div>
            <div class="dropdown-item threat-safe" data-threat-level="FALSE_POSITIVE">
              <i data-lucide="feather" style="width:16px;height:16px"></i>
              <span>False Positive</span>
            </div>
          </div>
        </div>
        <button class="header-action-btn" id="btn-audio" title="Toggle Audio Alerts">
          <i data-lucide="volume-2" style="width:18px;height:18px"></i>
        </button>
        <button class="header-action-btn" id="btn-notifications" title="Notifications">
          <i data-lucide="bell" style="width:18px;height:18px"></i>
        </button>
        <button class="header-action-btn" id="btn-settings" title="Settings">
          <i data-lucide="log-out" style="width:18px;height:18px"></i>
        </button>
      </div>
    `;

    this.container.appendChild(this.el);

    // Cache DOM refs
    this.statTargets = this.el.querySelector('#stat-targets');
    this.statThreats = this.el.querySelector('#stat-threats');
    this.statFps = this.el.querySelector('#stat-fps');
    this.statTime = this.el.querySelector('#stat-time');
    this.btnAudio = this.el.querySelector('#btn-audio');
    this.btnSpawn = this.el.querySelector('#btn-spawn');
    this.spawnMenu = this.el.querySelector('#spawn-menu');

    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });

    // Dropdown toggle click
    this.btnSpawn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.spawnMenu.classList.toggle('show');
    });

    // Close dropdown on click outside
    this._clickOutsideHandler = (e) => {
      if (!this.el.querySelector('#spawn-dropdown').contains(e.target)) {
        this.spawnMenu.classList.remove('show');
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    // Dropdown items click handlers
    const dropdownItems = this.spawnMenu.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', () => {
        const level = item.dataset.threatLevel;
        if (level === 'RANDOM') {
          this.eventBus.emit('demo:spawn');
        } else {
          this.eventBus.emit('demo:spawn', { threatLevel: level });
        }
        this.spawnMenu.classList.remove('show');
      });
    });

    // Audio toggle
    this.btnAudio.addEventListener('click', () => {
      this.audioEnabled = !this.audioEnabled;
      this.btnAudio.classList.toggle('active', this.audioEnabled);
      import('../utils/audio.js').then((m) => m.toggleAudioAlerts(this.audioEnabled));
    });
    this.btnAudio.classList.add('active');

    // Start clock
    this._clockInterval = setInterval(() => this._updateClock(), 1000);
    this._updateClock();
  }

  bindEvents() {
    this.eventBus.on(EVENTS.TARGET_UPDATE, ({ targets }) => {
      this.targetCount = targets.length;
      this.criticalCount = targets.filter(
        (t) => t.threatLevel === 'CRITICAL' || t.threatLevel === 'WARNING'
      ).length;
      this._updateStats();
    });

    this.eventBus.on(EVENTS.ENGINE_STATUS, ({ fps }) => {
      if (fps !== undefined) this.fps = fps;
      this._updateStats();
    });
  }

  _updateStats() {
    if (this.statTargets) this.statTargets.textContent = this.targetCount;
    if (this.statThreats) this.statThreats.textContent = this.criticalCount;
    if (this.statFps) this.statFps.textContent = this.fps;
  }

  _updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (this.statTime) this.statTime.textContent = `${h}:${m}:${s}`;
  }

  destroy() {
    clearInterval(this._clockInterval);
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
    }
    this.el.remove();
  }
}
