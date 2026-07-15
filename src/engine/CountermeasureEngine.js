/**
 * AeroGuard AI — CountermeasureEngine
 * Finite state machine for countermeasure activation, effects, and cooldowns.
 *
 * State Machine: IDLE → ARMING → ACTIVE → COOLDOWN → IDLE
 */

import { COUNTERMEASURES, EVENTS } from '../utils/constants.js';
import { gaussianRandom } from '../utils/math.js';

const CM_STATES = {
  IDLE: 'IDLE',
  ARMING: 'ARMING',
  ACTIVE: 'ACTIVE',
  COOLDOWN: 'COOLDOWN',
};

export class CountermeasureEngine {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventBus
   * @param {import('./TargetManager.js').TargetManager} targetManager
   */
  constructor(eventBus, targetManager) {
    this.eventBus = eventBus;
    this.targetManager = targetManager;

    /** @type {Map<string, object>} key = `${cmType}:${targetId}` */
    this.activeCountermeasures = new Map();

    /** @type {Map<string, number>} cooldown end timestamps per cmType */
    this.cooldowns = new Map();

    // Listen for activation requests
    this.eventBus.on(EVENTS.COUNTERMEASURE_ACTIVATE, (payload) => {
      this.activate(payload.type, payload.targetId);
    });
  }

  /**
   * Activate a countermeasure against a target.
   * @param {string} type - Countermeasure type key
   * @param {string} targetId - Target to affect
   * @returns {boolean} Success
   */
  activate(type, targetId) {
    const cmDef = COUNTERMEASURES[type];
    if (!cmDef) {
      console.warn(`[CM] Unknown countermeasure type: ${type}`);
      return false;
    }

    // Check if on cooldown
    if (this.isOnCooldown(type)) {
      return false;
    }

    // Check if already active on this target
    const key = `${type}:${targetId}`;
    if (this.activeCountermeasures.has(key)) {
      return false;
    }

    // Check target exists
    const target = this.targetManager.getTarget(targetId);
    if (!target || target.status === 'DESTROYED') {
      return false;
    }

    // Create countermeasure instance
    const cm = {
      type,
      targetId,
      state: CM_STATES.ARMING,
      startTime: Date.now(),
      armEndTime: Date.now() + cmDef.armDelay,
      activeEndTime: Date.now() + cmDef.armDelay + cmDef.duration,
      def: cmDef,
    };

    this.activeCountermeasures.set(key, cm);

    // Add to target's countermeasure list
    if (!target.countermeasures.includes(type)) {
      target.countermeasures.push(type);
    }

    this._emitStatus(type, targetId, CM_STATES.ARMING);

    this.eventBus.emit(EVENTS.ALERT_LOG, {
      level: 'WARNING',
      message: `${cmDef.name} arming against ${targetId}`,
      timestamp: Date.now(),
      type: 'countermeasure',
    });

    return true;
  }

  /**
   * Deactivate a countermeasure.
   * @param {string} type
   * @param {string} targetId
   */
  deactivate(type, targetId) {
    const key = `${type}:${targetId}`;
    const cm = this.activeCountermeasures.get(key);
    if (!cm) return;

    this._startCooldown(type, cm.def.cooldown);
    this.activeCountermeasures.delete(key);

    // Remove from target
    const target = this.targetManager.getTarget(targetId);
    if (target) {
      target.countermeasures = target.countermeasures.filter((c) => c !== type);
    }

    this._emitStatus(type, targetId, CM_STATES.COOLDOWN);
  }

  /**
   * Update all active countermeasures on each tick.
   * @param {number} dt - Delta time in seconds
   */
  tick(dt) {
    const now = Date.now();
    const toRemove = [];

    for (const [key, cm] of this.activeCountermeasures) {
      const target = this.targetManager.getTarget(cm.targetId);

      // Target was destroyed
      if (!target || target.status === 'DESTROYED') {
        toRemove.push(key);
        this._startCooldown(cm.type, cm.def.cooldown);
        this._emitStatus(cm.type, cm.targetId, CM_STATES.IDLE);
        continue;
      }

      // State transitions
      if (cm.state === CM_STATES.ARMING && now >= cm.armEndTime) {
        cm.state = CM_STATES.ACTIVE;
        this._emitStatus(cm.type, cm.targetId, CM_STATES.ACTIVE);

        this.eventBus.emit(EVENTS.ALERT_LOG, {
          level: 'CRITICAL',
          message: `${cm.def.name} ACTIVE on ${cm.targetId}`,
          timestamp: now,
          type: 'countermeasure',
        });
      }

      if (cm.state === CM_STATES.ACTIVE && now >= cm.activeEndTime) {
        toRemove.push(key);
        this._startCooldown(cm.type, cm.def.cooldown);
        target.countermeasures = target.countermeasures.filter((c) => c !== cm.type);
        this._emitStatus(cm.type, cm.targetId, CM_STATES.COOLDOWN);

        this.eventBus.emit(EVENTS.ALERT_LOG, {
          level: 'INFO',
          message: `${cm.def.name} deactivated on ${cm.targetId}`,
          timestamp: now,
          type: 'countermeasure',
        });
        continue;
      }

      // Apply effects while ACTIVE
      if (cm.state === CM_STATES.ACTIVE) {
        this._applyEffect(cm.type, target, dt);
      }
    }

    // Clean up finished countermeasures
    for (const key of toRemove) {
      this.activeCountermeasures.delete(key);
    }
  }

  /**
   * Apply countermeasure effects to target.
   * @private
   */
  _applyEffect(type, target, dt) {
    switch (type) {
      case 'RF_JAMMER':
        // Drop velocity to 0, randomize angular velocity
        target.v *= 0.9; // decay to 0
        target.omega = gaussianRandom(0, 0.1);
        target.status = 'JAMMED';
        break;

      case 'GPS_SPOOFING':
        // Shift bearing away from center
        const spoofRate = 0.05;
        target.theta += spoofRate * dt;
        target.v = Math.abs(target.v) * 0.5; // slow drift outward
        target.status = 'SPOOFED';
        break;

      case 'KINETIC_INTERCEPT':
        // Move target closer to destruction
        target.r -= 50 * dt; // interceptor approach
        if (target.r <= 20) {
          target.status = 'DESTROYED';
          this.targetManager.removeTarget(target.id, 'intercepted');
          this.eventBus.emit(EVENTS.ALERT_LOG, {
            level: 'CRITICAL',
            message: `${target.id} DESTROYED by kinetic intercept`,
            timestamp: Date.now(),
            type: 'destroy',
          });
        } else {
          target.status = 'INTERCEPTED';
        }
        break;

      case 'LASER_DAZZLER':
        // Disrupt sensors — randomize behavior
        target.behaviorPattern = Math.max(0, target.behaviorPattern - 0.1 * dt);
        target.omega += gaussianRandom(0, 0.02);
        target.status = 'JAMMED';
        break;

      case 'NET_CAPTURE':
        // Slow down and capture
        target.v *= 0.8;
        target.altitude = Math.max(0, target.altitude - 20 * dt);
        if (target.altitude <= 5) {
          target.status = 'DESTROYED';
          this.targetManager.removeTarget(target.id, 'captured');
          this.eventBus.emit(EVENTS.ALERT_LOG, {
            level: 'WARNING',
            message: `${target.id} CAPTURED by net system`,
            timestamp: Date.now(),
            type: 'destroy',
          });
        }
        break;

      case 'AIR_RAID_ALARM':
        // No target modification — audio only
        break;
    }
  }

  /**
   * Check if a countermeasure type is on cooldown.
   * @param {string} type
   * @returns {boolean}
   */
  isOnCooldown(type) {
    const cooldownEnd = this.cooldowns.get(type);
    if (!cooldownEnd) return false;
    if (Date.now() >= cooldownEnd) {
      this.cooldowns.delete(type);
      return false;
    }
    return true;
  }

  /**
   * Get remaining cooldown time in ms.
   * @param {string} type
   * @returns {number}
   */
  getCooldownRemaining(type) {
    const cooldownEnd = this.cooldowns.get(type);
    if (!cooldownEnd) return 0;
    return Math.max(0, cooldownEnd - Date.now());
  }

  /**
   * Check if a countermeasure is currently active.
   * @param {string} type
   * @returns {boolean}
   */
  isActive(type) {
    for (const cm of this.activeCountermeasures.values()) {
      if (cm.type === type && cm.state === CM_STATES.ACTIVE) return true;
    }
    return false;
  }

  /**
   * @private
   */
  _startCooldown(type, duration) {
    this.cooldowns.set(type, Date.now() + duration);
  }

  /**
   * @private
   */
  _emitStatus(type, targetId, status) {
    this.eventBus.emit(EVENTS.COUNTERMEASURE_STATUS, { type, targetId, status });
  }
}
