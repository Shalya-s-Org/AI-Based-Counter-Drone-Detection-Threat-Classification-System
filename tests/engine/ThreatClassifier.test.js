import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreatClassifier } from '../../src/engine/ThreatClassifier.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { EVENTS, THREAT_LEVELS, THREAT_LABELS } from '../../src/utils/constants.js';

describe('ThreatClassifier', () => {
  let eventBus;
  let classifier;

  beforeEach(() => {
    eventBus = new EventEmitter();
    classifier = new ThreatClassifier(eventBus);
  });

  it('should compute initial threat score and assign correct labels and colors', () => {
    const target = {
      id: 'TGT-001',
      speed: 15, // f(v) = 15/30 = 0.5
      altitude: 100, // dangerAlt = 100 => dist = 0 => g(a) = 1.0
      rcs: 1.0, // h(s) = 1.0/2.0 = 0.5
      behaviorPattern: 0.8, // k(b) = 0.8
      threatLevel: null,
      status: 'ACTIVE'
    };

    // Expected score computation:
    // weights = { speed: 25, altitude: 20, rcs: 25, behavior: 30 }
    // score = 25*0.5 + 20*1.0 + 25*0.5 + 30*0.8 = 12.5 + 20 + 12.5 + 24 = 69
    // 69 >= 60 (THREAT_THRESHOLDS.LOW) => THREAT_LEVELS.WARNING
    
    const classification = classifier.classify(target);

    expect(classification.score).toBe(69);
    expect(classification.level).toBe(THREAT_LEVELS.WARNING);
    expect(target.threatScore).toBe(69);
    expect(target.threatLevel).toBe(THREAT_LEVELS.WARNING);
    expect(target.threatLabel).toBe(THREAT_LABELS.WARNING);
    expect(target.threatColor).toBeDefined();
  });

  it('should emit threat:reclassify event only when level changes', () => {
    const target = {
      id: 'TGT-001',
      speed: 5,
      altitude: 400,
      rcs: 0.1,
      behaviorPattern: 0.1,
      threatLevel: THREAT_LEVELS.LOW, // initial
      status: 'ACTIVE'
    };

    const reclassifyListener = vi.fn();
    eventBus.on(EVENTS.THREAT_RECLASSIFY, reclassifyListener);

    // This will calculate a low score (around 15-20) which is FALSE_POSITIVE level
    classifier.classify(target);

    expect(reclassifyListener).toHaveBeenCalledTimes(1);
    expect(reclassifyListener).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'TGT-001',
      oldLevel: THREAT_LEVELS.LOW,
      newLevel: THREAT_LEVELS.FALSE_POSITIVE
    }));

    // Classify again with same values — should not emit reclassification again
    classifier.classify(target);
    expect(reclassifyListener).toHaveBeenCalledTimes(1);
  });

  it('should process batch target classification in classifyAll', () => {
    const target1 = { id: 'T1', speed: 5, altitude: 400, rcs: 0.1, behaviorPattern: 0.1, status: 'ACTIVE' };
    const target2 = { id: 'T2', speed: 28, altitude: 100, rcs: 1.9, behaviorPattern: 0.9, status: 'ACTIVE' };
    const targets = [target1, target2];

    classifier.classifyAll(targets);

    expect(target1.threatScore).toBeLessThan(30);
    expect(target2.threatScore).toBeGreaterThan(80);
    expect(target2.threatLevel).toBe(THREAT_LEVELS.CRITICAL);
  });

  it('should accept weight updates via setWeights', () => {
    const target = {
      id: 'TGT-001',
      speed: 15,
      altitude: 100,
      rcs: 1.0,
      behaviorPattern: 0.8,
      status: 'ACTIVE'
    };

    // Update weights to only focus on speed
    classifier.setWeights({
      speed: 100,
      altitude: 0,
      rcs: 0,
      behavior: 0
    });

    // f(v) = 15/30 = 0.5 => 100 * 0.5 = 50
    const classification = classifier.classify(target);
    expect(classification.score).toBe(50);
  });

  it('should return level for score via static helper getLevelForScore', () => {
    expect(ThreatClassifier.getLevelForScore(90)).toBe(THREAT_LEVELS.CRITICAL);
    expect(ThreatClassifier.getLevelForScore(70)).toBe(THREAT_LEVELS.WARNING);
    expect(ThreatClassifier.getLevelForScore(40)).toBe(THREAT_LEVELS.LOW);
    expect(ThreatClassifier.getLevelForScore(10)).toBe(THREAT_LEVELS.FALSE_POSITIVE);
  });
});
