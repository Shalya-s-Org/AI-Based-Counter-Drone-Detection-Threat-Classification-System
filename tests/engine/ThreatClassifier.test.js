import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThreatClassifier } from '../../src/engine/ThreatClassifier.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';

describe('ThreatClassifier', () => {
  let emitter;
  let classifier;

  beforeEach(() => {
    emitter = new EventEmitter();
    classifier = new ThreatClassifier(emitter);
  });

  const baseTarget = {
    v: 20,
    altitude: 200,
    rcs: 0.5,
    behaviorPattern: 0.6,
    threatScore: 0,
    threatLevel: null,
    targetLabel: null,
  };

  it('should classify low-speed low-altitude as FALSE_POSITIVE', () => {
    const target = { ...baseTarget, v: 2, altitude: 200, rcs: 0.01, behaviorPattern: 0.1 };
    const result = classifier.classifyTarget(target);
    expect(result.threatLevel).toBe('FALSE_POSITIVE');
    expect(result.targetLabel).toBe('Bird / Weather Balloon');
  });

  it('should classify high-speed high-altitude as CRITICAL', () => {
    const target = { ...baseTarget, v: 35, altitude: 500, rcs: 2.0, behaviorPattern: 1.0 };
    const result = classifier.classifyTarget(target);
    expect(result.threatLevel).toBe('CRITICAL');
    expect(result.targetLabel).toBe('Weaponized / Military UAV');
  });

  it('should classify medium threat as WARNING', () => {
    const target = { ...baseTarget, v: 25, altitude: 100, rcs: 1.0, behaviorPattern: 0.8 };
    const result = classifier.classifyTarget(target);
    expect(result.threatLevel).toBe('WARNING');
    expect(result.targetLabel).toBe('Commercial Drone (Heavy Payload)');
  });

  it('should clamp score to 0-100', () => {
    const target = { ...baseTarget, v: 100, altitude: 1000, rcs: 10, behaviorPattern: 2 };
    const result = classifier.classifyTarget(target);
    expect(result.threatScore).toBeGreaterThanOrEqual(0);
    expect(result.threatScore).toBeLessThanOrEqual(100);
  });

  it('should emit threat:reclassify on level change', () => {
    const handler = vi.fn();
    emitter.on('threat:reclassify', handler);
    const target = { ...baseTarget, threatLevel: 'FALSE_POSITIVE' };
    classifier.classifyAll([target]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not emit threat:reclassify when level unchanged', () => {
    const handler = vi.fn();
    emitter.on('threat:reclassify', handler);
    const target = { ...baseTarget };
    classifier.classifyAll([target]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should classify all targets in batch', () => {
    const t1 = { ...baseTarget, id: 'T1' };
    const t2 = { ...baseTarget, id: 'T2', v: 35, altitude: 500, rcs: 2.0, behaviorPattern: 1.0 };
    classifier.classifyAll([t1, t2]);
    expect(t1.threatLevel).not.toBeNull();
    expect(t2.threatLevel).toBe('CRITICAL');
  });

  it('should return threat level for score via public API', () => {
    expect(classifier.getThreatLevel(10)).toBe('FALSE_POSITIVE');
    expect(classifier.getThreatLevel(40)).toBe('LOW');
    expect(classifier.getThreatLevel(70)).toBe('WARNING');
    expect(classifier.getThreatLevel(90)).toBe('CRITICAL');
  });
});
