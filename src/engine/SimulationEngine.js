/**
 * AeroGuard AI — SimulationEngine
 * Main game loop orchestrating all sub-engines via requestAnimationFrame.
 */

import { EVENTS } from '../utils/constants.js';

export class SimulationEngine {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventBus
   * @param {import('./TargetManager.js').TargetManager} targetManager
   * @param {import('./ThreatClassifier.js').ThreatClassifier} threatClassifier
   * @param {import('./CountermeasureEngine.js').CountermeasureEngine} countermeasureEngine
   */
  constructor(eventBus, targetManager, threatClassifier, countermeasureEngine) {
    this.eventBus = eventBus;
    this.targetManager = targetManager;
    this.threatClassifier = threatClassifier;
    this.countermeasureEngine = countermeasureEngine;

    this._running = false;
    this._paused = false;
    this._rafId = null;
    this._lastTimestamp = 0;
    this._fps = 0;
    this._frameCount = 0;
    this._fpsUpdateTimer = 0;
    this._elapsed = 0;
  }

  /**
   * Start the simulation loop.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this._lastTimestamp = performance.now();
    this._frameCount = 0;
    this._fpsUpdateTimer = 0;

    // Spawn initial targets
    const initialCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < initialCount; i++) {
      this.targetManager.spawnTarget();
    }

    // Initial classification
    this.threatClassifier.classifyAll(
      Array.from(this.targetManager.targets.values())
    );

    this._tick(performance.now());

    this.eventBus.emit(EVENTS.ENGINE_STATUS, {
      running: true,
      fps: 0,
      targetCount: this.targetManager.count,
    });
  }

  /**
   * Stop the simulation loop.
   */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this.eventBus.emit(EVENTS.ENGINE_STATUS, {
      running: false,
      fps: 0,
      targetCount: 0,
    });
  }

  /**
   * Pause the simulation (rendering continues but state doesn't update).
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resume a paused simulation.
   */
  resume() {
    if (this._paused) {
      this._paused = false;
      this._lastTimestamp = performance.now();
    }
  }

  /**
   * Main tick — called every animation frame.
   * @private
   * @param {number} timestamp - DOMHighResTimeStamp from requestAnimationFrame
   */
  _tick(timestamp) {
    if (!this._running) return;

    this._rafId = requestAnimationFrame((ts) => this._tick(ts));

    // Calculate delta time in seconds, cap at 100ms to prevent spiral of death
    const rawDt = (timestamp - this._lastTimestamp) / 1000;
    const dt = Math.min(rawDt, 0.1);
    this._lastTimestamp = timestamp;
    this._elapsed += dt;

    // FPS tracking
    this._frameCount++;
    this._fpsUpdateTimer += dt;
    if (this._fpsUpdateTimer >= 1.0) {
      this._fps = Math.round(this._frameCount / this._fpsUpdateTimer);
      this._frameCount = 0;
      this._fpsUpdateTimer = 0;
    }

    // Skip updates if paused
    if (this._paused) return;

    // ── Tick Sequence ──────────────────────────────────
    // 1. Update target positions
    this.targetManager.updateAll(dt);

    // 2. Classify all targets
    this.threatClassifier.classifyAll(
      Array.from(this.targetManager.targets.values())
    );

    // 3. Process countermeasures
    this.countermeasureEngine.tick(dt);

    // 4. Auto-spawn logic
    this.targetManager.tryAutoSpawn(dt);

    // 5. Emit engine status (throttled to 1/sec)
    if (this._fpsUpdateTimer === 0) {
      this.eventBus.emit(EVENTS.ENGINE_STATUS, {
        running: true,
        fps: this._fps,
        targetCount: this.targetManager.count,
        elapsed: this._elapsed,
      });
    }
  }

  /**
   * Get current FPS.
   * @returns {number}
   */
  get fps() {
    return this._fps;
  }

  /**
   * Check if engine is running.
   * @returns {boolean}
   */
  get isRunning() {
    return this._running;
  }
}
