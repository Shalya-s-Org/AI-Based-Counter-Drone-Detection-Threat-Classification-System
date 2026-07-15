import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CountermeasureEngine } from '../../src/engine/CountermeasureEngine.js';
import { TargetManager } from '../../src/engine/TargetManager.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { EVENTS } from '../../src/utils/constants.js';

describe('CountermeasureEngine', () => {
  let eventBus;
  let targetManager;
  let cmEngine;

  beforeEach(() => {
    eventBus = new EventEmitter();
    targetManager = new TargetManager(eventBus);
    cmEngine = new CountermeasureEngine(eventBus, targetManager);
  });

  it('should activate a countermeasure and transition to ARMING state', () => {
    const target = targetManager.spawnTarget();
    const statusListener = vi.fn();
    eventBus.on(EVENTS.COUNTERMEASURE_STATUS, statusListener);

    const success = cmEngine.activate('RF_JAMMER', target.id);

    expect(success).toBe(true);
    expect(target.countermeasures).toContain('RF_JAMMER');
    expect(statusListener).toHaveBeenCalledWith({
      type: 'RF_JAMMER',
      targetId: target.id,
      status: 'ARMING'
    });
  });

  it('should fail activation if target is missing', () => {
    const success = cmEngine.activate('RF_JAMMER', 'NON_EXISTENT');
    expect(success).toBe(false);
  });

  it('should transition from ARMING to ACTIVE on tick when arming time passes', () => {
    const target = targetManager.spawnTarget();
    cmEngine.activate('RF_JAMMER', target.id);

    // Mock Date.now to simulate arm delay passing (armDelay = 1000ms typically)
    const now = Date.now();
    const originalNow = Date.now;
    Date.now = () => now + 1500; // pass arming delay

    const statusListener = vi.fn();
    eventBus.on(EVENTS.COUNTERMEASURE_STATUS, statusListener);

    cmEngine.tick(0.1);

    expect(statusListener).toHaveBeenCalledWith({
      type: 'RF_JAMMER',
      targetId: target.id,
      status: 'ACTIVE'
    });

    Date.now = originalNow; // restore
  });

  it('should transition from ACTIVE to COOLDOWN/IDLE on tick when duration passes', () => {
    const target = targetManager.spawnTarget();
    cmEngine.activate('RF_JAMMER', target.id);

    const now = Date.now();
    const originalNow = Date.now;
    
    // Simulate passing duration + arm delay (e.g. 500ms + 10000ms = 10500ms)
    Date.now = () => now + 12000;

    const statusListener = vi.fn();
    eventBus.on(EVENTS.COUNTERMEASURE_STATUS, statusListener);

    cmEngine.tick(0.1);

    expect(statusListener).toHaveBeenCalledWith({
      type: 'RF_JAMMER',
      targetId: target.id,
      status: 'COOLDOWN'
    });
    expect(target.countermeasures).not.toContain('RF_JAMMER');

    Date.now = originalNow; // restore
  });

  it('should apply RF_JAMMER effect during ACTIVE state', () => {
    const target = targetManager.spawnTarget();
    target.v = -10.0;
    
    cmEngine.activate('RF_JAMMER', target.id);
    const key = `RF_JAMMER:${target.id}`;
    const instance = cmEngine.activeCountermeasures.get(key);
    instance.state = 'ACTIVE'; // force state to active

    cmEngine.tick(0.1);

    expect(target.status).toBe('JAMMED');
    expect(target.v).toBeCloseTo(-9.0, 1); // decay target velocity
  });

  it('should apply GPS_SPOOFING effect and drift target', () => {
    const target = targetManager.spawnTarget();
    target.theta = 1.0;
    target.v = -10;

    cmEngine.activate('GPS_SPOOFING', target.id);
    const key = `GPS_SPOOFING:${target.id}`;
    cmEngine.activeCountermeasures.get(key).state = 'ACTIVE';

    cmEngine.tick(1.0);

    expect(target.status).toBe('SPOOFED');
    expect(target.theta).toBeCloseTo(1.05, 2);
    expect(target.v).toBe(5); // slow drift outward
  });

  it('should apply KINETIC_INTERCEPT effect and destroy target when target.r <= 20', () => {
    const target = targetManager.spawnTarget();
    target.r = 30;

    cmEngine.activate('KINETIC_INTERCEPT', target.id);
    const key = `KINETIC_INTERCEPT:${target.id}`;
    cmEngine.activeCountermeasures.get(key).state = 'ACTIVE';

    cmEngine.tick(0.1); // Interceptor moves closer (30 - 50*0.1 = 25)
    expect(target.status).toBe('INTERCEPTED');
    expect(target.r).toBeCloseTo(25, 1);

    cmEngine.tick(0.1); // Interceptor moves closer (25 - 5 = 20)
    // Should destroy target
    expect(targetManager.getTarget(target.id)).toBeUndefined();
  });

  it('should apply NET_CAPTURE and bring down altitude to destroy target', () => {
    const target = targetManager.spawnTarget();
    target.altitude = 15;

    cmEngine.activate('NET_CAPTURE', target.id);
    const key = `NET_CAPTURE:${target.id}`;
    cmEngine.activeCountermeasures.get(key).state = 'ACTIVE';

    cmEngine.tick(0.2); // altitude decays by 20*0.2 = 4 (15 - 4 = 11)
    expect(target.altitude).toBeCloseTo(11, 1);

    cmEngine.tick(0.4); // altitude decays by 20*0.4 = 8 (11 - 8 = 3 <= 5)
    // Should capture and destroy target
    expect(targetManager.getTarget(target.id)).toBeUndefined();
  });
});
