import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TargetManager } from '../../src/engine/TargetManager.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { EVENTS } from '../../src/utils/constants.js';
import { ThreatClassifier } from '../../src/engine/ThreatClassifier.js';

describe('TargetManager', () => {
  let eventBus;
  let targetManager;

  beforeEach(() => {
    eventBus = new EventEmitter();
    targetManager = new TargetManager(eventBus);
  });

  it('should spawn a target and emit events', () => {
    const spawnListener = vi.fn();
    const logListener = vi.fn();

    eventBus.on(EVENTS.TARGET_SPAWN, spawnListener);
    eventBus.on(EVENTS.ALERT_LOG, logListener);

    const target = targetManager.spawnTarget();

    expect(target).toBeDefined();
    expect(target.id).toMatch(/^TGT-\d{3}$/);
    expect(target.status).toBe('ACTIVE');
    expect(target.trail.length).toBe(0);

    expect(spawnListener).toHaveBeenCalledTimes(1);
    expect(spawnListener).toHaveBeenCalledWith(expect.objectContaining({ target }));
    expect(logListener).toHaveBeenCalledTimes(1);
  });

  it('should update target positions and build trails on updateAll', () => {
    const updateListener = vi.fn();
    eventBus.on(EVENTS.TARGET_UPDATE, updateListener);

    const target = targetManager.spawnTarget();
    const initialR = target.r;
    const initialTheta = target.theta;

    // Simulate 1 second step
    targetManager.updateAll(1.0);

    const updatedTarget = targetManager.getTarget(target.id);
    expect(updatedTarget.r).not.toBe(initialR);
    expect(updatedTarget.trail.length).toBe(1);
    expect(updatedTarget.trail[0]).toEqual({ x: updatedTarget.x, y: updatedTarget.y });

    expect(updateListener).toHaveBeenCalledTimes(1);
    expect(updateListener).toHaveBeenCalledWith(expect.objectContaining({
      targets: expect.any(Array)
    }));
  });

  it('should limit target trails to a maximum of 30 entries', () => {
    const target = targetManager.spawnTarget();

    // Perform 35 updates
    for (let i = 0; i < 35; i++) {
      targetManager.updateAll(0.1);
    }

    const updatedTarget = targetManager.getTarget(target.id);
    expect(updatedTarget.trail.length).toBe(30);
  });

  it('should despawn a target if it goes out of range', () => {
    const destroyListener = vi.fn();
    eventBus.on(EVENTS.TARGET_DESTROY, destroyListener);

    const target = targetManager.spawnTarget();
    // Force target radius beyond despawn radius
    target.r = 2000; 

    targetManager.updateAll(0.1);

    expect(targetManager.getTarget(target.id)).toBeUndefined();
    expect(destroyListener).toHaveBeenCalledTimes(1);
    expect(destroyListener).toHaveBeenCalledWith({ targetId: target.id, reason: 'out_of_range' });
  });

  it('should despawn a target if it gets too close to the radar center', () => {
    const destroyListener = vi.fn();
    eventBus.on(EVENTS.TARGET_DESTROY, destroyListener);

    const target = targetManager.spawnTarget();
    // Force target radius extremely close to center
    target.r = 2; 

    targetManager.updateAll(0.1);

    expect(targetManager.getTarget(target.id)).toBeUndefined();
    expect(destroyListener).toHaveBeenCalledTimes(1);
  });

  it('should manually remove a target', () => {
    const destroyListener = vi.fn();
    eventBus.on(EVENTS.TARGET_DESTROY, destroyListener);

    const target = targetManager.spawnTarget();
    targetManager.removeTarget(target.id, 'neutralized');

    expect(targetManager.getTarget(target.id)).toBeUndefined();
    expect(destroyListener).toHaveBeenCalledTimes(1);
    expect(destroyListener).toHaveBeenCalledWith({ targetId: target.id, reason: 'neutralized' });
  });

  it('should sort active targets by threat score descending', () => {
    const t1 = targetManager.spawnTarget();
    const t2 = targetManager.spawnTarget();
    const t3 = targetManager.spawnTarget();

    // Manually assign distinct threat scores
    t1.threatScore = 30;
    t2.threatScore = 90;
    t3.threatScore = 60;

    const active = targetManager.getActiveTargets();
    expect(active[0].id).toBe(t2.id); // 90
    expect(active[1].id).toBe(t3.id); // 60
    expect(active[2].id).toBe(t1.id); // 30
  });

  it('should auto-spawn new targets to maintain minTargets limits', () => {
    // Initially 0 targets
    expect(targetManager.count).toBe(0);

    // Try auto-spawn (simulating interval elapsed)
    // Spawn interval is 4000ms by default in constants.js
    targetManager.tryAutoSpawn(4.1);

    // Should spawn because targets count (0) < minTargets (3 by default)
    expect(targetManager.count).toBeGreaterThan(0);
  });

  it('should spawn a target matching the requested specific threat level', () => {
    const classifier = new ThreatClassifier(eventBus);
    const levels = ['CRITICAL', 'WARNING', 'LOW', 'FALSE_POSITIVE'];

    for (const level of levels) {
      const target = targetManager.spawnTarget(level);
      const classification = classifier.classify(target);
      expect(classification.level).toBe(level);
    }
  });
});
