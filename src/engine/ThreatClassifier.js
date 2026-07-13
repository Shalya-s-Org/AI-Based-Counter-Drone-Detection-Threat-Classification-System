/**
 * @fileoverview AeroGuard AI — Threat Classifier
 * Computes a composite threat score for each tracked UAV contact using
 * weighted normalised features (speed, altitude, RCS, behaviour pattern)
 * and maps the result to a discrete threat tier.
 * @module engine/ThreatClassifier
 */

import {
  THREAT_LEVELS,
  TARGET_LABELS,
  SCORING_WEIGHTS,
  EVENT_TYPES,
} from '../utils/constants.js';

import { clamp, normalize } from '../utils/math.js';

/**
 * Classifies UAV targets into threat tiers based on observable attributes.
 */
export class ThreatClassifier {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventEmitter
   */
  constructor(eventEmitter) {
    /** @type {import('./EventEmitter.js').EventEmitter} */
    this._emitter = eventEmitter;
  }

  /* ─────────────── Feature Normalisers (0 → 1) ─────────────── */

  /**
   * Normalise speed to a [0, 1] score.
   * Faster targets are more threatening.
   * @private
   * @param {number} speed — m/s (absolute value used).
   * @returns {number}
   */
  _normalizeSpeed(speed) {
    return clamp(Math.abs(speed) / 30, 0, 1);
  }

  /**
   * Normalise altitude using a U‑shaped curve:
   * very low (< 30 m) or very high (> 400 m) → higher threat,
   * mid‑range (~200 m) → lower threat.
   * @private
   * @param {number} altitude — metres AGL.
   * @returns {number}
   */
  _normalizeAltitude(altitude) {
    // Distance from the "safe" mid‑band (200 m), scaled.
    const raw = 1 - Math.abs(altitude - 200) / 250;
    return clamp(1 - raw, 0, 1); // Invert so extremes score higher.
  }

  /**
   * Normalise Radar Cross Section.
   * Larger signatures are more threatening (military‑grade platforms).
   * @private
   * @param {number} rcs — m².
   * @returns {number}
   */
  _normalizeRCS(rcs) {
    return clamp(rcs / 2.0, 0, 1);
  }

  /* ──────────────── Single‑Target Classification ──────────────── */

  /**
   * Compute the composite threat score for a single target and assign
   * the appropriate threat level and human‑readable label.
   *
   * The score is a weighted sum (0–100):
   * ```
   * TS = w.speed   × normSpeed(v)
   *    + w.altitude × normAlt(a)
   *    + w.rcs      × normRCS(s)
   *    + w.behavior × behaviorPattern
   * ```
   *
   * @param {import('./TargetManager.js').Target} target
   * @returns {import('./TargetManager.js').Target} The mutated target (for chaining).
   */
  classifyTarget(target) {
    const speedScore     = SCORING_WEIGHTS.speed    * this._normalizeSpeed(target.v);
    const altitudeScore  = SCORING_WEIGHTS.altitude * this._normalizeAltitude(target.altitude);
    const rcsScore       = SCORING_WEIGHTS.rcs      * this._normalizeRCS(target.rcs);
    const behaviorScore  = SCORING_WEIGHTS.behavior * clamp(target.behaviorPattern, 0, 1);

    const compositeScore = clamp(
      speedScore + altitudeScore + rcsScore + behaviorScore,
      0,
      100,
    );

    target.threatScore = Math.round(compositeScore * 100) / 100;
    target.threatLevel = this._getThreatLevel(target.threatScore);
    target.targetLabel = TARGET_LABELS[target.threatLevel] ?? 'Unknown';

    return target;
  }

  /* ──────────────── Batch Classification ──────────────── */

  /**
   * Classify an array of targets.  For any target whose threat **level**
   * changes, emits {@link EVENT_TYPES.THREAT_RECLASSIFY}.
   *
   * @param {import('./TargetManager.js').Target[]} targets
   */
  classifyAll(targets) {
    for (const target of targets) {
      const previousLevel = target.threatLevel;

      this.classifyTarget(target);

      if (previousLevel !== null && previousLevel !== target.threatLevel) {
        this._emitter.emit(EVENT_TYPES.THREAT_RECLASSIFY, {
          target,
          previousLevel,
          newLevel: target.threatLevel,
        });
      }
    }
  }

  /* ──────────────── Level Lookup ──────────────── */

  /**
   * Map a numeric score (0–100) to a {@link THREAT_LEVELS} key.
   *
   * @private
   * @param {number} score
   * @returns {string} Key from `THREAT_LEVELS`.
   */
  _getThreatLevel(score) {
    for (const [key, def] of Object.entries(THREAT_LEVELS)) {
      if (score >= def.min && score <= def.max) {
        return key;
      }
    }
    // Fallback — should never happen if ranges are contiguous.
    return 'FALSE_POSITIVE';
  }

  /**
   * Public accessor for the level‑lookup helper.
   * @param {number} score
   * @returns {string}
   */
  getThreatLevel(score) {
    return this._getThreatLevel(score);
  }
}
