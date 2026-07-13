/**
 * @fileoverview AeroGuard AI — Simulation Engine
 * Top‑level orchestrator that owns the `requestAnimationFrame` game loop,
 * delegates to sub‑systems (targets, classifier, countermeasures), and
 * broadcasts engine telemetry every frame.
 * @module engine/SimulationEngine
 */

import { EVENT_TYPES, SIMULATION_CONFIG } from '../utils/constants.js';
import { TargetManager } from './TargetManager.js';
import { ThreatClassifier } from './ThreatClassifier.js';
import { CountermeasureEngine } from './CountermeasureEngine.js';

/**
 * Central simulation controller.
 *
 * @example
 * const bus = new EventEmitter();
 * const sim = new SimulationEngine(bus);
 * sim.start();                // begins rAF loop
 * sim.togglePause();          // pause / resume
 * sim.stop();                 // tear down
 */
export class SimulationEngine {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventEmitter
   */
  constructor(eventEmitter) {
    /** @type {import('./EventEmitter.js').EventEmitter} */
    this._emitter = eventEmitter;

    /* ── Sub‑systems ── */
    /** @type {TargetManager} */
    this._targetManager = new TargetManager(eventEmitter);

    /** @type {ThreatClassifier} */
    this._classifier = new ThreatClassifier(eventEmitter);

    /** @type {CountermeasureEngine} */
    this._countermeasureEngine = new CountermeasureEngine(eventEmitter, this._targetManager);

    /* ── Loop state ── */
    /** @type {boolean} */
    this.running = false;

    /** @type {boolean} */
    this.paused = false;

    /** @type {number|null} */
    this.animFrameId = null;

    /** @type {number} Last rAF timestamp (ms). */
    this.lastTimestamp = 0;

    /** @type {number} Last time a target was auto‑spawned (ms). */
    this.lastSpawnTime = 0;

    /** @type {number} Smoothed frames‑per‑second. */
    this.fps = 0;

    /** @type {number} Total frames rendered since `start()`. */
    this.frameCount = 0;

    /** @type {number} Timestamp when the engine was started. */
    this._startTime = 0;

    // Bind once so we can cancel correctly.
    this._boundTick = this.tick.bind(this);
  }

  /* ──────────────────── Lifecycle ──────────────────── */

  /**
   * Start the simulation loop.
   */
  start() {
    if (this.running) return;

    this.running = true;
    this.paused = false;
    this.lastTimestamp = 0;
    this.lastSpawnTime = 0;
    this.frameCount = 0;
    this._startTime = Date.now();

    this.animFrameId = requestAnimationFrame(this._boundTick);
  }

  /**
   * Stop the simulation and cancel the animation frame.
   */
  stop() {
    this.running = false;
    this.paused = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Pause the simulation (the loop keeps ticking but sub‑systems freeze).
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume from a paused state.
   */
  resume() {
    this.paused = false;
  }

  /**
   * Toggle between paused and running.
   * @returns {boolean} The new paused state.
   */
  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  /* ──────────────────── Main Loop ──────────────────── */

  /**
   * Called by `requestAnimationFrame` every frame.
   * @param {DOMHighResTimeStamp} timestamp — Milliseconds since page load.
   */
  tick(timestamp) {
    if (!this.running) return;

    // --- Delta time ---
    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const deltaTime = deltaMs / 1000; // → seconds

    if (!this.paused) {
      this.frameCount++;

      // --- Auto‑spawn ---
      this.lastSpawnTime += deltaMs;
      const targetCount = this._targetManager.getTargets().size;

      if (
        this.lastSpawnTime >= SIMULATION_CONFIG.spawnIntervalMs &&
        targetCount < SIMULATION_CONFIG.maxTargets
      ) {
        this._targetManager.spawnTarget();
        this.lastSpawnTime = 0;
      }

      // --- Sub‑system updates ---
      this._targetManager.updateAll(deltaTime);
      this._classifier.classifyAll(this._targetManager.getTargetsArray());
      this._countermeasureEngine.update(deltaTime);

      // --- FPS (exponential moving average) ---
      const instantFps = deltaMs > 0 ? 1000 / deltaMs : 60;
      this.fps = this.fps === 0 ? instantFps : this.fps * 0.9 + instantFps * 0.1;

      // --- Broadcast telemetry ---
      this._emitter.emit(EVENT_TYPES.ENGINE_STATUS, {
        running: this.running,
        paused: this.paused,
        fps: Math.round(this.fps),
        targetCount: this._targetManager.getTargets().size,
        elapsed: Date.now() - this._startTime,
      });
    }

    // Schedule next frame.
    this.animFrameId = requestAnimationFrame(this._boundTick);
  }

  /* ──────────────────── Accessors ──────────────────── */

  /**
   * @returns {TargetManager}
   */
  getTargetManager() {
    return this._targetManager;
  }

  /**
   * @returns {ThreatClassifier}
   */
  getClassifier() {
    return this._classifier;
  }

  /**
   * @returns {CountermeasureEngine}
   */
  getCountermeasureEngine() {
    return this._countermeasureEngine;
  }

  /**
   * Return a snapshot of engine statistics.
   *
   * @returns {{
   *   running: boolean,
   *   paused: boolean,
   *   fps: number,
   *   frameCount: number,
   *   targetCount: number,
   *   elapsed: number
   * }}
   */
  getStats() {
    return {
      running: this.running,
      paused: this.paused,
      fps: Math.round(this.fps),
      frameCount: this.frameCount,
      targetCount: this._targetManager.getTargets().size,
      elapsed: Date.now() - this._startTime,
    };
  }
}
