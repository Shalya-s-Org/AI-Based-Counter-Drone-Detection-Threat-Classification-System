/**
 * @fileoverview AeroGuard AI — Countermeasure Engine
 * State machine governing the activation, effect simulation, duration
 * tracking, and cooldown management of all defensive countermeasure systems.
 * @module engine/CountermeasureEngine
 */

import {
  COUNTERMEASURE_TYPES,
  EVENT_TYPES,
  TARGET_STATUSES,
} from '../utils/constants.js';

import { gaussianRandom } from '../utils/math.js';

/**
 * @typedef {Object} CountermeasureState
 * @property {string}      targetId  — ID of the engaged target (may be `null` for ALARM).
 * @property {number}      startTime — `Date.now()` when activated.
 * @property {Object}      type      — Reference to the `COUNTERMEASURE_TYPES` definition.
 * @property {'active'|'cooldown'} status
 * @property {Object|null} meta      — Extra state for the specific CM type.
 */

/**
 * Manages countermeasure activation, per‑frame effect updates, and cooldowns.
 */
export class CountermeasureEngine {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventEmitter
   * @param {import('./TargetManager.js').TargetManager} targetManager
   */
  constructor(eventEmitter, targetManager) {
    /** @type {import('./EventEmitter.js').EventEmitter} */
    this._emitter = eventEmitter;

    /** @type {import('./TargetManager.js').TargetManager} */
    this._targetManager = targetManager;

    /**
     * Active / cooling‑down countermeasure entries, keyed by CM type key.
     * @type {Map<string, CountermeasureState>}
     */
    this.activeCountermeasures = new Map();
  }

  /* ──────────────────── Activation ──────────────────── */

  /**
   * Attempt to activate a countermeasure against a target.
   *
   * @param {string} typeKey  — Key from {@link COUNTERMEASURE_TYPES}.
   * @param {string|null} targetId — Target to engage (`null` for ALARM).
   * @returns {boolean} `true` if activation succeeded, `false` if on cooldown
   *                    or the target does not exist.
   */
  activate(typeKey, targetId) {
    // Guard: cooldown or already active.
    if (this.isOnCooldown(typeKey)) return false;

    const cmDef = COUNTERMEASURE_TYPES[typeKey];
    if (!cmDef) {
      console.warn(`[CountermeasureEngine] Unknown type "${typeKey}".`);
      return false;
    }

    // Resolve target (ALARM doesn't need one).
    const target = targetId ? this._targetManager.getTarget(targetId) : null;
    if (typeKey !== 'ALARM' && !target) {
      console.warn(`[CountermeasureEngine] Target "${targetId}" not found.`);
      return false;
    }

    // --- Build state entry ---
    /** @type {CountermeasureState} */
    const state = {
      targetId,
      startTime: Date.now(),
      type: cmDef,
      status: 'active',
      meta: null,
    };

    // --- Immediate effect ---
    switch (typeKey) {
      case 'RF_JAM':
        if (target) {
          state.meta = { originalV: target.v, originalOmega: target.omega };
          target.status = TARGET_STATUSES.JAMMED;
        }
        break;

      case 'GPS_SPOOF':
        if (target) {
          state.meta = { originalTheta: target.theta };
          target.status = TARGET_STATUSES.SPOOFED;
        }
        break;

      case 'KINETIC':
        if (target) {
          state.meta = {
            interceptorR: 0,
            interceptorTheta: target.theta + Math.PI, // launch from opposite side
            interceptorSpeed: Math.abs(target.v) * 3 + 50, // faster than target
          };
          target.status = TARGET_STATUSES.INTERCEPTED;
        }
        break;

      case 'ALARM':
        // No per‑target effect.
        break;

      default:
        break;
    }

    this.activeCountermeasures.set(typeKey, state);

    // --- Events ---
    this._emitter.emit(EVENT_TYPES.COUNTERMEASURE_ACTIVATE, {
      type: typeKey,
      targetId,
      label: cmDef.label,
    });

    this._emitter.emit(EVENT_TYPES.ALERT_LOG, {
      level: 'INFO',
      message: `${cmDef.label} activated${target ? ` on ${targetId}` : ''}`,
      timestamp: Date.now(),
    });

    return true;
  }

  /* ──────────────────── Per‑Frame Update ──────────────────── */

  /**
   * Advance all active countermeasure effects and manage cooldown timers.
   * Should be called once per simulation frame.
   *
   * @param {number} deltaTime — Elapsed time in **seconds**.
   */
  update(deltaTime) {
    const now = Date.now();

    for (const [typeKey, state] of this.activeCountermeasures) {
      const elapsed = now - state.startTime;
      const cmDef = state.type;

      if (state.status === 'active') {
        const target = state.targetId
          ? this._targetManager.getTarget(state.targetId)
          : null;

        // --- Per‑type effect simulation ---
        switch (typeKey) {
          case 'RF_JAM':
            if (target && target.status !== TARGET_STATUSES.DESTROYED) {
              // Gradually slow the target to a halt.
              target.v *= (1 - 1.5 * deltaTime);
              if (Math.abs(target.v) < 0.1) target.v = 0;
              // Add random omega jitter (loss of navigation).
              target.omega += gaussianRandom(0, 0.02);
            }
            break;

          case 'GPS_SPOOF':
            if (target && target.status !== TARGET_STATUSES.DESTROYED) {
              // Deflect bearing away from the installation centre.
              target.theta += 0.08 * deltaTime;
              // Push radially outward.
              target.v = Math.abs(target.v) * 0.6 + 2;
            }
            break;

          case 'KINETIC':
            if (target && state.meta && target.status !== TARGET_STATUSES.DESTROYED) {
              const m = state.meta;
              // Advance interceptor toward target.
              const dr = target.r - m.interceptorR;
              const dTheta = target.theta - m.interceptorTheta;

              m.interceptorR += m.interceptorSpeed * deltaTime;
              m.interceptorTheta += dTheta * 2 * deltaTime;

              // Collision check.
              const dist = Math.abs(target.r - m.interceptorR);
              if (dist < 15) {
                target.status = TARGET_STATUSES.DESTROYED;
                this._targetManager.removeTarget(target.id);

                this._emitter.emit(EVENT_TYPES.ALERT_LOG, {
                  level: 'SUCCESS',
                  message: `Kinetic intercept hit — ${target.id} destroyed`,
                  timestamp: Date.now(),
                });

                this._emitter.emit(EVENT_TYPES.COUNTERMEASURE_COMPLETE, {
                  type: typeKey,
                  targetId: state.targetId,
                  result: 'HIT',
                });

                this._transitionToCooldown(typeKey, state, now);
              }
            }
            break;

          case 'ALARM':
            // Alarm has no per‑frame effect.
            break;

          default:
            break;
        }

        // --- Duration check → transition to cooldown ---
        const durationMs = cmDef.duration;
        if (durationMs !== null && elapsed >= durationMs) {
          this._transitionToCooldown(typeKey, state, now);
        } else if (durationMs === null && typeKey !== 'KINETIC') {
          this._transitionToCooldown(typeKey, state, now);
        }
      }

      // --- Cooldown expiry ---
      if (state.status === 'cooldown') {
        const cooldownElapsed = now - state.startTime;
        if (cooldownElapsed >= cmDef.cooldown) {
          this.activeCountermeasures.delete(typeKey);
        }
      }
    }

    // Emit aggregated status for UI.
    this._emitter.emit(EVENT_TYPES.COUNTERMEASURE_STATUS, this.getCooldowns());
  }

  /* ──────────────────── Internal Helpers ──────────────────── */

  /**
   * Move a countermeasure from active → cooldown.
   * @private
   * @param {string} typeKey
   * @param {CountermeasureState} state
   * @param {number} now
   */
  _transitionToCooldown(typeKey, state, now) {
    state.status = 'cooldown';
    state.startTime = now; // Reset for cooldown timer.

    // Restore target state where applicable.
    const target = state.targetId
      ? this._targetManager.getTarget(state.targetId)
      : null;

    if (target) {
      switch (typeKey) {
        case 'RF_JAM':
          if (target.status === TARGET_STATUSES.JAMMED && state.meta) {
            target.status = TARGET_STATUSES.ACTIVE;
            target.v = state.meta.originalV;
            target.omega = state.meta.originalOmega;
          }
          break;

        case 'GPS_SPOOF':
          if (target.status === TARGET_STATUSES.SPOOFED) {
            target.status = TARGET_STATUSES.ACTIVE;
          }
          break;

        default:
          break;
      }
    }

    if (!this._wasCompleteEmitted(typeKey)) {
      this._emitter.emit(EVENT_TYPES.COUNTERMEASURE_COMPLETE, {
        type: typeKey,
        targetId: state.targetId,
        result: 'EXPIRED',
      });
    }
  }

  /**
   * Guard against duplicate COMPLETE emissions for KINETIC hits.
   * @private
   * @param {string} _typeKey
   * @returns {boolean}
   */
  _wasCompleteEmitted(_typeKey) {
    // KINETIC emits COMPLETE inline on hit — avoid double‑emit.
    return _typeKey === 'KINETIC';
  }

  /* ──────────────────── Public Queries ──────────────────── */

  /**
   * Check whether a countermeasure type is currently on cooldown
   * (or still actively engaged).
   * @param {string} typeKey
   * @returns {boolean}
   */
  isOnCooldown(typeKey) {
    return this.activeCountermeasures.has(typeKey);
  }

  /**
   * Get detailed status for a single countermeasure type.
   *
   * @param {string} typeKey
   * @returns {{ active: boolean, cooldownRemaining: number, progress: number }|null}
   */
  getStatus(typeKey) {
    const state = this.activeCountermeasures.get(typeKey);
    if (!state) {
      return { active: false, cooldownRemaining: 0, progress: 1 };
    }

    const cmDef = state.type;
    const now = Date.now();
    const elapsed = now - state.startTime;

    if (state.status === 'active') {
      const totalDuration = cmDef.duration ?? 0;
      return {
        active: true,
        cooldownRemaining: cmDef.cooldown,
        progress: totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 1,
      };
    }

    // Cooldown phase.
    const remaining = Math.max(cmDef.cooldown - elapsed, 0);
    return {
      active: false,
      cooldownRemaining: remaining,
      progress: cmDef.cooldown > 0 ? 1 - remaining / cmDef.cooldown : 1,
    };
  }

  /**
   * Return cooldown / status snapshots for **all** countermeasure types,
   * suitable for direct consumption by the UI layer.
   *
   * @returns {Object<string, { active: boolean, cooldownRemaining: number, progress: number }>}
   */
  getCooldowns() {
    const result = {};
    for (const key of Object.keys(COUNTERMEASURE_TYPES)) {
      result[key] = this.getStatus(key);
    }
    return result;
  }
}
