import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CountermeasureEngine } from '../../src/engine/CountermeasureEngine.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { TargetManager } from '../../src/engine/TargetManager.js';

describe('CountermeasureEngine', () => {
  let emitter;
  let targetManager;
  let engine;

  beforeEach(() => {
    emitter = new EventEmitter();
    targetManager = new TargetManager(emitter);
    engine = new CountermeasureEngine(emitter, targetManager);
  });

  it('should activate RF_JAM on a target', () => {
    const target = targetManager.spawnTarget();
    const handler = vi.fn();
    emitter.on('countermeasure:activate', handler);
    const result = engine.activate('RF_JAM', target.id);
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual({ type: 'RF_JAM', targetId: target.id, label: 'RF Jammer' });
    expect(target.status).toBe('JAMMED');
  });

  it('should activate GPS_SPOOF on a target', () => {
    const target = targetManager.spawnTarget();
    const result = engine.activate('GPS_SPOOF', target.id);
    expect(result).toBe(true);
    expect(target.status).toBe('SPOOFED');
  });

  it('should activate KINETIC on a target', () => {
    const target = targetManager.spawnTarget();
    const result = engine.activate('KINETIC', target.id);
    expect(result).toBe(true);
    expect(target.status).toBe('INTERCEPTED');
  });

  it('should activate ALARM without target', () => {
    const result = engine.activate('ALARM', null);
    expect(result).toBe(true);
  });

  it('should reject activation if on cooldown', () => {
    const target = targetManager.spawnTarget();
    engine.activate('RF_JAM', target.id);
    const result = engine.activate('RF_JAM', target.id);
    expect(result).toBe(false);
  });

  it('should reject activation for unknown type', () => {
    const result = engine.activate('UNKNOWN', null);
    expect(result).toBe(false);
  });

  it('should reject activation for missing target', () => {
    const result = engine.activate('RF_JAM', 'TGT-999');
    expect(result).toBe(false);
  });

  it('should report cooldown status', () => {
    const target = targetManager.spawnTarget();
    engine.activate('RF_JAM', target.id);
    const status = engine.getStatus('RF_JAM');
    expect(status.active).toBe(true);
    expect(status.cooldownRemaining).toBeGreaterThan(0);
  });

  it('should get cooldowns for all types', () => {
    const target = targetManager.spawnTarget();
    engine.activate('RF_JAM', target.id);
    const cooldowns = engine.getCooldowns();
    expect(cooldowns.RF_JAM).toBeDefined();
    expect(cooldowns.ALARM).toBeDefined();
  });

  it('should update RF_JAM effect and restore target after duration', () => {
    const target = targetManager.spawnTarget();
    const originalV = target.v;
    engine.activate('RF_JAM', target.id);
    expect(target.status).toBe('JAMMED');

    const startTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
    engine.update(0.1);
    vi.advanceTimersByTime(10000);
    engine.update(0.1);
    vi.useRealTimers();

    expect(target.status).toBe('ACTIVE');
    expect(target.v).toBe(originalV);
  });

  it('should destroy target on kinetic intercept', () => {
    const target = targetManager.spawnTarget();
    engine.activate('KINETIC', target.id);

    const startTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
    for (let i = 0; i < 200; i++) {
      vi.advanceTimersByTime(100);
      engine.update(0.1);
    }
    vi.useRealTimers();

    expect(targetManager.getTarget(target.id)).toBeUndefined();
  });

  it('should emit countermeasure:complete on expiry', () => {
    const handler = vi.fn();
    emitter.on('countermeasure:complete', handler);
    const target = targetManager.spawnTarget();
    engine.activate('GPS_SPOOF', target.id);

    const startTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
    vi.advanceTimersByTime(15000);
    engine.update(0.1);
    vi.useRealTimers();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
