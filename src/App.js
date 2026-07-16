/**
 * AeroGuard AI — App Assembly
 * Dashboard layout assembly, component wiring, and lifecycle management.
 */

import { EventEmitter } from './engine/EventEmitter.js';
import { TargetManager } from './engine/TargetManager.js';
import { ThreatClassifier } from './engine/ThreatClassifier.js';
import { CountermeasureEngine } from './engine/CountermeasureEngine.js';
import { SimulationEngine } from './engine/SimulationEngine.js';

import { HeaderBar } from './components/HeaderBar.js';
import { Radar } from './components/Radar.js';
import { ActiveTargets } from './components/ActiveTargets.js';
import { CameraFeed } from './components/CameraFeed.js';
import { TargetTelemetry } from './components/TargetTelemetry.js';
import { Controls } from './components/Controls.js';
import { AlertLog } from './components/AlertLog.js';

import { EVENTS } from './utils/constants.js';
import { playAlertSound } from './utils/audio.js';

export class App {
  /**
   * @param {HTMLElement} rootEl - The #app mount point
   */
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.components = [];

    this._init();
  }

  _init() {
    // ── Create Event Bus ──────────────────────────────────────
    this.eventBus = new EventEmitter();

    // ── Create Engine Layer ───────────────────────────────────
    this.targetManager = new TargetManager(this.eventBus);
    this.threatClassifier = new ThreatClassifier(this.eventBus);
    this.countermeasureEngine = new CountermeasureEngine(this.eventBus, this.targetManager);
    this.simulationEngine = new SimulationEngine(
      this.eventBus,
      this.targetManager,
      this.threatClassifier,
      this.countermeasureEngine
    );

    // ── Create Dashboard Layout ───────────────────────────────
    this.dashboard = document.createElement('div');
    this.dashboard.className = 'dashboard';
    this.rootEl.appendChild(this.dashboard);

    // ── Header (spans full width) ─────────────────────────────
    // HeaderBar renders directly into the dashboard as a grid item
    this.headerBar = new HeaderBar(this.dashboard, this.eventBus);
    this.components.push(this.headerBar);

    // ── Left Sidebar (Active Targets) ─────────────────────────
    // ActiveTargets renders its own glass-panel as a grid item
    this.activeTargets = new ActiveTargets(this.dashboard, this.eventBus);
    this.components.push(this.activeTargets);

    // ── Center (Radar) ────────────────────────────────────────
    // Radar renders its own glass-panel as a grid item
    this.radar = new Radar(this.dashboard, this.eventBus);
    this.components.push(this.radar);

    // ── Right Panel (Camera + Telemetry + Controls + Log) ─────
    const rightPanel = document.createElement('div');
    rightPanel.className = 'right-panel';
    this.dashboard.appendChild(rightPanel);

    // Camera Feed
    this.cameraFeed = new CameraFeed(rightPanel, this.eventBus);
    this.components.push(this.cameraFeed);

    // Target Telemetry
    this.targetTelemetry = new TargetTelemetry(rightPanel, this.eventBus);
    this.components.push(this.targetTelemetry);

    // Controls (Quick Actions)
    this.controls = new Controls(rightPanel, this.eventBus, this.countermeasureEngine);
    this.components.push(this.controls);

    // Alert Log
    this.alertLog = new AlertLog(rightPanel, this.eventBus);
    this.components.push(this.alertLog);

    // ── Wire Audio Alerts ─────────────────────────────────────
    this._wireAudioAlerts();

    // ── Listen for Demo Spawn Requests ─────────────────────────
    this.eventBus.on('demo:spawn', ({ threatLevel } = {}) => {
      this.targetManager.spawnTarget(threatLevel);
    });

    // ── Start Simulation ──────────────────────────────────────
    this.simulationEngine.start();
  }

  /**
   * Wire audio alerts to threat events so sounds play on
   * critical spawns and reclassifications.
   * @private
   */
  _wireAudioAlerts() {
    // Play sound when a new target spawns
    this.eventBus.on(EVENTS.TARGET_SPAWN, ({ target }) => {
      if (target.threatLevel === 'CRITICAL') {
        playAlertSound('CRITICAL');
      }
    });

    // Play sound when a target's threat level escalates
    this.eventBus.on(EVENTS.THREAT_RECLASSIFY, ({ newLevel, oldLevel }) => {
      // Only alert on escalation, not de-escalation
      const levels = ['FALSE_POSITIVE', 'LOW', 'WARNING', 'CRITICAL'];
      if (levels.indexOf(newLevel) > levels.indexOf(oldLevel)) {
        playAlertSound(newLevel);
      }
    });

    // Play sound on countermeasure activation
    this.eventBus.on(EVENTS.COUNTERMEASURE_STATUS, ({ status }) => {
      if (status === 'ACTIVE') {
        playAlertSound('WARNING');
      }
    });
  }

  /**
   * Tear down the entire application.
   */
  destroy() {
    this.simulationEngine.stop();

    for (const component of this.components) {
      if (component.destroy) component.destroy();
    }

    this.eventBus.removeAll();
    this.dashboard.remove();
  }
}
