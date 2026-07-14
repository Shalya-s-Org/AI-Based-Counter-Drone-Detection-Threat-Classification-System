import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TargetManager } from '../../src/engine/TargetManager.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';

describe('TargetManager', () => {
  let emitter;
  let manager;

  beforeEach(() => {
    emitter = new EventEmitter();
    manager = new TargetManager(emitter);
  });

  it('should spawn a target with required fields', () => {
    const target = manager.spawnTarget();
    expect(target).toBeDefined();
    expect(target.id).toMatch(/^TGT-\d+$/);
    expect(target.r).toBeGreaterThan(0);
    expect(target.theta).toBeGreaterThanOrEqual(0);
    expect(target.theta).toBeLessThan(Math.PI * 2);
    expect(typeof target.v).toBe('number');
    expect(typeof target.omega).toBe('number');
    expect(target.altitude).toBeGreaterThanOrEqual(0);
    expect(target.rcs).toBeGreaterThan(0);
    expect(target.status).toBe('ACTIVE');
    expect(target.threatScore).toBe(0);
    expect(target.threatLevel).toBeNull();
    expect(target.targetLabel).toBeNull();
  });

  it('should emit target:spawn on spawn', () => {
    const handler = vi.fn();
    emitter.on('target:spawn', handler);
    const target = manager.spawnTarget();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe(target);
  });

  it('should retrieve target by ID', () => {
    const target = manager.spawnTarget();
    const found = manager.getTarget(target.id);
    expect(found).toBe(target);
  });

  it('should return undefined for unknown ID', () => {
    expect(manager.getTarget('TGT-999')).toBeUndefined();
  });

  it('should return all targets as array', () => {
    manager.spawnTarget();
    manager.spawnTarget();
    const arr = manager.getTargetsArray();
    expect(arr).toHaveLength(2);
  });

  it('should remove target and emit target:destroy', () => {
    const target = manager.spawnTarget();
    const handler = vi.fn();
    emitter.on('target:destroy', handler);
    manager.removeTarget(target.id);
    expect(manager.getTarget(target.id)).toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe(target);
  });

  it('should update target positions over time', () => {
    const target = manager.spawnTarget();
    const initialR = target.r;
    const initialTheta = target.theta;
    manager.updateAll(1);
    const updated = manager.getTarget(target.id);
    expect(updated).toBeDefined();
    expect(updated.x).toBeDefined();
    expect(updated.y).toBeDefined();
  });

  it('should remove targets that exceed max range', () => {
    const target = manager.spawnTarget();
    target.r = 2000;
    manager.updateAll(1);
    expect(manager.getTarget(target.id)).toBeUndefined();
  });

  it('should not remove destroyed targets twice', () => {
    const target = manager.spawnTarget();
    manager.removeTarget(target.id);
    expect(() => manager.removeTarget(target.id)).not.toThrow();
  });
});
