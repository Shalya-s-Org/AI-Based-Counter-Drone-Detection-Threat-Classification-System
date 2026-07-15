/**
 * AeroGuard AI — ThreatClassifier
 * AI-powered threat scoring and classification engine.
 *
 * TS = w_v·f(v) + w_a·g(a) + w_s·h(s) + w_b·k(b)
 */

import {
  THREAT_WEIGHTS,
  THREAT_THRESHOLDS,
  THREAT_LEVELS,
  THREAT_COLORS,
  THREAT_LABELS,
  EVENTS,
} from '../utils/constants.js';
import { normalize, clamp } from '../utils/math.js';

export class ThreatClassifier {
  /**
   * @param {import('./EventEmitter.js').EventEmitter} eventBus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.weights = { ...THREAT_WEIGHTS };
  }

  /**
   * Classify a single target. Returns enriched classification data
   * and mutates the target object with threat info.
   * @param {object} target
   * @returns {{ score: number, level: string, label: string, color: string }}
   */
  classify(target) {
    const score = this._computeScore(target);

    // Determine threat level
    let level, label, color;

    if (score >= THREAT_THRESHOLDS.WARNING) {
      level = THREAT_LEVELS.CRITICAL;
      label = THREAT_LABELS.CRITICAL;
      color = THREAT_COLORS.CRITICAL;
    } else if (score >= THREAT_THRESHOLDS.LOW) {
      level = THREAT_LEVELS.WARNING;
      label = THREAT_LABELS.WARNING;
      color = THREAT_COLORS.WARNING;
    } else if (score >= THREAT_THRESHOLDS.FALSE_POSITIVE) {
      level = THREAT_LEVELS.LOW;
      label = THREAT_LABELS.LOW;
      color = THREAT_COLORS.LOW;
    } else {
      level = THREAT_LEVELS.FALSE_POSITIVE;
      label = THREAT_LABELS.FALSE_POSITIVE;
      color = THREAT_COLORS.FALSE_POSITIVE;
    }

    // Check for reclassification
    const oldLevel = target.threatLevel;
    const reclassified = oldLevel && oldLevel !== level;

    // Mutate target
    target.threatScore = score;
    target.threatLevel = level;
    target.threatLabel = label;
    target.threatColor = color;

    // Emit reclassification event if changed
    if (reclassified) {
      this.eventBus.emit(EVENTS.THREAT_RECLASSIFY, {
        targetId: target.id,
        oldLevel,
        newLevel: level,
        score,
      });
    }

    return { score, level, label, color };
  }

  /**
   * Classify all targets in batch.
   * @param {object[]} targets
   */
  classifyAll(targets) {
    for (const target of targets) {
      if (target.status !== 'DESTROYED') {
        this.classify(target);
      }
    }
  }

  /**
   * Compute the raw threat score from telemetry vector.
   * @private
   * @param {object} target
   * @returns {number} Score in [0, 100]
   */
  _computeScore(target) {
    // f(v): Speed normalization — faster = higher threat
    const fv = normalize(target.speed, 0, 30);

    // g(a): Altitude risk — near danger altitude (100m) = higher threat
    const dangerAlt = 100;
    const maxAlt = 500;
    const altDist = Math.abs(target.altitude - dangerAlt);
    const ga = 1.0 - normalize(altDist, 0, maxAlt);

    // h(s): RCS normalization — larger = higher threat
    const hs = normalize(target.rcs, 0, 2.0);

    // k(b): Behavior pattern — direct ingress = 1.0
    const kb = clamp(target.behaviorPattern, 0, 1);

    // Weighted sum
    const raw =
      this.weights.speed * fv +
      this.weights.altitude * ga +
      this.weights.rcs * hs +
      this.weights.behavior * kb;

    return clamp(Math.round(raw), 0, 100);
  }

  /**
   * Update classification weights.
   * @param {object} newWeights
   */
  setWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get the threat level for a given score.
   * @param {number} score
   * @returns {string}
   */
  static getLevelForScore(score) {
    if (score >= THREAT_THRESHOLDS.WARNING) return THREAT_LEVELS.CRITICAL;
    if (score >= THREAT_THRESHOLDS.LOW) return THREAT_LEVELS.WARNING;
    if (score >= THREAT_THRESHOLDS.FALSE_POSITIVE) return THREAT_LEVELS.LOW;
    return THREAT_LEVELS.FALSE_POSITIVE;
  }
}
