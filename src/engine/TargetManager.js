/**
 * @fileoverview AeroGuard AI — Target Manager
 * Owns the full lifecycle of simulated UAV contacts: spawning at the radar
 * perimeter, advancing each frame with physics + noise, and removing
 * targets that exit the engagement zone or reach the installation.
 * @module engine/TargetManager
 */

import {
  SIMULATION_CONFIG,
  RADAR_CONFIG,
  EVENT_TYPES,
  TARGET_STATUSES,
} from '../utils/constants.js';

import {
  polarToCartesian,
  gaussianRandom,
  generateId,
  randomRange,
} from '../utils/math.js';

/**
 * @typedef {Object} Target
 * @property {string}  id              — Unique identifier (e.g. `TGT-007`).
 * @property {number}  r               — Radial distance from radar centre (m).
 * @property {number}  theta           — Bearing in radians.
 * @property {number}  x               — Cartesian X (derived).
 * @property {number}  y               — Cartesian Y (derived).
 * @property {number}  v               — Radial speed (m/s, negative = inbound).
 * @property {number}  omega           — Angular velocity (rad/s).
 * @property {number}  altitude        — Altitude AGL in metres.
 * @property {number}  rcs             — Radar Cross Section (m²).
 * @property {number}  behaviorPattern — Threat‑behaviour heuristic ∈ [0, 1].
 * @property {string}  status          — One of {@link TARGET_STATUSES}.
 * @property {number}  threatScore     — Composite score 0–100.
 * @property {string|null}  threatLevel  — Key from {@link THREAT_LEVELS} or null.
 * @property {string|null}  targetLabel  — Human‑readable label or null.
 * @property {number}  spawnTime       — `Date.now()` at creation.
 */

/**
 * Manages the live set of simulated UAV targets.
 */
export class TargetManager {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventEmitter
   */
  constructor(eventEmitter) {
    /** @type {import('./EventEmitter.js').EventEmitter} */
    this._emitter = eventEmitter;

    /**
     * Active target store, keyed by target ID.
     * @type {Map<string, Target>}
     */
    this.targets = new Map();
  }

  /* ──────────────────── Spawning ──────────────────── */

  /**
   * Create a new target at the radar periphery with randomised attributes.
   * Emits {@link EVENT_TYPES.TARGET_SPAWN}.
   * @returns {Target} The newly created target.
   */
  spawnTarget() {
    const { maxRange } = RADAR_CONFIG;
    const {
      minSpeed, maxSpeed,
      minAltitude, maxAltitude,
      minRCS, maxRCS,
    } = SIMULATION_CONFIG;

    // Spawn near the outer edge (60 %–95 % of max range).
    const r = randomRange(maxRange * 0.6, maxRange * 0.95);
    const theta = randomRange(0, Math.PI * 2);
    const { x, y } = polarToCartesian(r, theta);

    // Negative radial velocity → approaching the installation.
    // ~80 % of targets are inbound; the rest drift outward or orbit.
    const speedMagnitude = randomRange(minSpeed, maxSpeed);
    const v = Math.random() < 0.8 ? -speedMagnitude : speedMagnitude * 0.4;

    // Small angular velocity for curved flight paths.
    const omega = randomRange(-0.05, 0.05);

    /** @type {Target} */
    const target = {
      id: generateId('TGT'),
      r,
      theta,
      x,
      y,
      v,
      omega,
      altitude: randomRange(minAltitude, maxAltitude),
      rcs: randomRange(minRCS, maxRCS),
      behaviorPattern: randomRange(0.1, 1.0),
      status: TARGET_STATUSES.ACTIVE,
      threatScore: 0,
      threatLevel: null,
      targetLabel: null,
      spawnTime: Date.now(),
    };

    this.targets.set(target.id, target);
    this._emitter.emit(EVENT_TYPES.TARGET_SPAWN, target);

    return target;
  }

  /* ──────────────────── Frame Update ──────────────────── */

  /**
   * Advance every target's position by `deltaTime` seconds, applying
   * Gaussian noise for realistic jitter.  Targets that reach the
   * installation centre (r < 5 m) or exit the detection envelope
   * (r > 110 % maxRange) are automatically removed.
   *
   * Emits {@link EVENT_TYPES.TARGET_UPDATE} with the full target array.
   *
   * @param {number} deltaTime — Elapsed time in **seconds** since last tick.
   */
  updateAll(deltaTime) {
    const maxR = RADAR_CONFIG.maxRange;

    for (const [id, target] of this.targets) {
      // Skip destroyed contacts — they await cleanup by other systems.
      if (target.status === TARGET_STATUSES.DESTROYED) continue;

      // --- Angular motion ---
      target.theta += target.omega * deltaTime + gaussianRandom(0, 0.005);

      // --- Radial motion ---
      target.r += target.v * deltaTime + gaussianRandom(0, 0.3);

      // --- Derive Cartesian position ---
      const { x, y } = polarToCartesian(target.r, target.theta);
      target.x = x;
      target.y = y;

      // --- Boundary pruning ---
      if (target.r < 5 || target.r > maxR * 1.1) {
        this.removeTarget(id);
      }
    }

    this._emitter.emit(EVENT_TYPES.TARGET_UPDATE, this.getTargetsArray());
  }

  /* ──────────────────── Removal ──────────────────── */

  /**
   * Remove a target by ID.
   * Emits {@link EVENT_TYPES.TARGET_DESTROY}.
   * @param {string} id
   */
  removeTarget(id) {
    const target = this.targets.get(id);
    if (!target) return;

    this.targets.delete(id);
    this._emitter.emit(EVENT_TYPES.TARGET_DESTROY, target);
  }

  /* ──────────────────── Accessors ──────────────────── */

  /**
   * Return the live Map of all targets.
   * @returns {Map<string, Target>}
   */
  getTargets() {
    return this.targets;
  }

  /**
   * Retrieve a single target by ID.
   * @param {string} id
   * @returns {Target|undefined}
   */
  getTarget(id) {
    return this.targets.get(id);
  }

  /**
   * Return all targets as a plain array (useful for iteration / rendering).
   * @returns {Target[]}
   */
  getTargetsArray() {
    return Array.from(this.targets.values());
  }
}
