/**
 * AeroGuard AI — TargetManager
 * Spawns, updates, and despawns UAV targets in the simulation.
 */

import { TARGET_CONFIG, UAV_TYPES, EVENTS } from '../utils/constants.js';
import { polarToCartesian, gaussianRandom, randomRange, randomInt, clamp } from '../utils/math.js';

let targetCounter = 0;

export class TargetManager {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventBus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    /** @type {Map<string, object>} */
    this.targets = new Map();
    this._spawnTimer = 0;
  }

  /**
   * Spawn a new UAV target with randomized state vector.
   * @returns {object} The spawned target
   */
  spawnTarget() {
    targetCounter++;
    const id = `${TARGET_CONFIG.idPrefix}-${String(targetCounter).padStart(3, '0')}`;

    // Random UAV type
    const uavType = UAV_TYPES[randomInt(0, UAV_TYPES.length - 1)];

    // Spawn at edge of radar range
    const theta = randomRange(0, Math.PI * 2);
    const r = randomRange(TARGET_CONFIG.despawnRadius * 0.8, TARGET_CONFIG.despawnRadius * 0.95) * RADAR_MAX_RANGE();

    // Velocity — move inward (negative radial velocity)
    const speed = randomRange(TARGET_CONFIG.speed.min, TARGET_CONFIG.speed.max);
    const v = -speed * randomRange(0.3, 1.0); // inward
    const omega = randomRange(TARGET_CONFIG.angularVelocity.min, TARGET_CONFIG.angularVelocity.max);

    // Physical properties
    const altitude = randomRange(TARGET_CONFIG.altitude.min, TARGET_CONFIG.altitude.max);
    const rcs = randomRange(uavType.rcsRange[0], uavType.rcsRange[1]);
    const behaviorPattern = randomRange(TARGET_CONFIG.behaviorPattern.min, TARGET_CONFIG.behaviorPattern.max);

    const target = {
      id,
      type: uavType.name,
      r,
      theta,
      v,
      omega,
      altitude,
      rcs,
      behaviorPattern,
      speed: Math.abs(v),
      threatScore: 0,
      threatLevel: 'LOW',
      threatLabel: '',
      threatColor: '',
      status: 'ACTIVE',
      countermeasures: [],
      spawnTime: Date.now(),
      lastUpdate: Date.now(),
      x: 0,
      y: 0,
      trail: [],
    };

    // Compute initial cartesian position
    this._updateCartesian(target);

    this.targets.set(id, target);

    this.eventBus.emit(EVENTS.TARGET_SPAWN, { target: { ...target } });
    this.eventBus.emit(EVENTS.ALERT_LOG, {
      level: 'INFO',
      message: `New contact detected: ${id} (${uavType.name})`,
      timestamp: Date.now(),
      type: 'spawn',
    });

    return target;
  }

  /**
   * Update all target positions based on deltaTime.
   * @param {number} dt - Delta time in seconds
   */
  updateAll(dt) {
    const toRemove = [];

    for (const [id, target] of this.targets) {
      if (target.status === 'DESTROYED') {
        toRemove.push(id);
        continue;
      }

      // Apply Brownian motion noise
      const noiseR = gaussianRandom(0, TARGET_CONFIG.brownianSigma) * dt;
      const noiseTheta = gaussianRandom(0, TARGET_CONFIG.brownianSigma * 0.1) * dt;

      // Update polar coordinates
      target.r += target.v * dt + noiseR;
      target.theta += target.omega * dt + noiseTheta;

      // Normalize theta to [0, 2π]
      target.theta = ((target.theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // Update speed for display
      target.speed = Math.abs(target.v);

      // Update altitude with small drift
      target.altitude = clamp(
        target.altitude + gaussianRandom(0, 0.5) * dt,
        TARGET_CONFIG.altitude.min,
        TARGET_CONFIG.altitude.max
      );

      // Update cartesian position
      this._updateCartesian(target);

      // Store trail point (keep last 30 positions)
      target.trail.push({ x: target.x, y: target.y });
      if (target.trail.length > 30) {
        target.trail.shift();
      }

      target.lastUpdate = Date.now();

      // Check despawn condition (out of range)
      const maxR = RADAR_MAX_RANGE() * TARGET_CONFIG.despawnRadius;
      if (target.r > maxR || target.r < 5) {
        toRemove.push(id);
        this.eventBus.emit(EVENTS.TARGET_DESTROY, { targetId: id, reason: 'out_of_range' });
        this.eventBus.emit(EVENTS.ALERT_LOG, {
          level: 'INFO',
          message: `Contact lost: ${id} (out of range)`,
          timestamp: Date.now(),
          type: 'destroy',
        });
      }
    }

    // Remove despawned targets
    for (const id of toRemove) {
      this.targets.delete(id);
    }

    // Emit batch update
    if (this.targets.size > 0) {
      this.eventBus.emit(EVENTS.TARGET_UPDATE, {
        targets: this.getActiveTargets(),
      });
    }
  }

  /**
   * Attempt to spawn new targets to maintain minimum count.
   * @param {number} dt - Delta time in seconds
   */
  tryAutoSpawn(dt) {
    this._spawnTimer += dt * 1000;

    if (this._spawnTimer >= TARGET_CONFIG.spawnInterval) {
      this._spawnTimer = 0;

      if (this.targets.size < TARGET_CONFIG.maxTargets) {
        if (Math.random() < TARGET_CONFIG.spawnProbability || this.targets.size < TARGET_CONFIG.minTargets) {
          this.spawnTarget();
        }
      }
    }
  }

  /**
   * Remove a target by ID.
   * @param {string} id
   * @param {string} reason
   */
  removeTarget(id, reason = 'destroyed') {
    const target = this.targets.get(id);
    if (target) {
      target.status = 'DESTROYED';
      this.targets.delete(id);
      this.eventBus.emit(EVENTS.TARGET_DESTROY, { targetId: id, reason });
    }
  }

  /**
   * Get target by ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getTarget(id) {
    return this.targets.get(id);
  }

  /**
   * Get all active targets sorted by threat score (descending).
   * @returns {object[]}
   */
  getActiveTargets() {
    return Array.from(this.targets.values())
      .filter((t) => t.status !== 'DESTROYED')
      .sort((a, b) => b.threatScore - a.threatScore);
  }

  /**
   * Get target count.
   * @returns {number}
   */
  get count() {
    return this.targets.size;
  }

  /**
   * Update cartesian coordinates from polar.
   * @private
   */
  _updateCartesian(target) {
    const pos = polarToCartesian(target.r, target.theta);
    target.x = pos.x;
    target.y = pos.y;
  }
}

/**
 * Helper to get radar max range. Imported from constants but kept as function
 * to allow dynamic updates.
 */
function RADAR_MAX_RANGE() {
  return 1000; // matches RADAR_CONFIG.maxRange
}
