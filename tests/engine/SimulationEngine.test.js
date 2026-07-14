import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';

describe('SimulationEngine', () => {
  let emitter;
  let engine;

  beforeEach(() => {
    emitter = new EventEmitter();
    engine = new SimulationEngine(emitter);
  });

  it('should start and report running', () => {
    engine.start();
    expect(engine.running).toBe(true);
    expect(engine.paused).toBe(false);
  });

  it('should not double-start', () => {
    engine.start();
    engine.start();
    expect(engine.running).toBe(true);
  });

  it('should stop the engine', () => {
    engine.start();
    engine.stop();
    expect(engine.running).toBe(false);
    expect(engine.paused).toBe(false);
  });

  it('should toggle pause', () => {
    engine.start();
    expect(engine.togglePause()).toBe(true);
    expect(engine.paused).toBe(true);
    expect(engine.togglePause()).toBe(false);
    expect(engine.paused).toBe(false);
  });

  it('should emit engine:status on tick', async () => {
    engine.start();
    const handler = vi.fn();
    emitter.on('engine:status', handler);
    await new Promise((resolve) => setTimeout(resolve, 100));
    engine.stop();
    expect(handler).toHaveBeenCalled();
    const stats = handler.mock.calls[0][0];
    expect(stats).toHaveProperty('running');
    expect(stats).toHaveProperty('paused');
    expect(stats).toHaveProperty('fps');
    expect(stats).toHaveProperty('targetCount');
    expect(stats).toHaveProperty('elapsed');
  });

  it('should report stats via getStats', () => {
    engine.start();
    const stats = engine.getStats();
    expect(stats).toMatchObject({
      running: true,
      paused: false,
      fps: expect.any(Number),
      frameCount: expect.any(Number),
      targetCount: expect.any(Number),
      elapsed: expect.any(Number),
    });
    engine.stop();
  });

  it('should provide access to subsystems', () => {
    expect(engine.getTargetManager()).toBeDefined();
    expect(engine.getClassifier()).toBeDefined();
    expect(engine.getCountermeasureEngine()).toBeDefined();
  });

  it('should not tick after stop', async () => {
    engine.start();
    engine.stop();
    const handler = vi.fn();
    emitter.on('engine:status', handler);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const callsAfterStop = handler.mock.calls.length;
    expect(callsAfterStop).toBe(0);
  });
});
