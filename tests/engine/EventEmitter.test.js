import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from '../../src/engine/EventEmitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  it('should subscribe and emit events', () => {
    const callback = vi.fn();
    emitter.on('test', callback);
    emitter.emit('test', 'payload');
    expect(callback).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith('payload');
  });

  it('should unsubscribe with returned function', () => {
    const callback = vi.fn();
    const unsub = emitter.on('test', callback);
    unsub();
    emitter.emit('test', 'payload');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should support multiple listeners for same event', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on('test', cb1);
    emitter.on('test', cb2);
    emitter.emit('test', 'data');
    expect(cb1).toHaveBeenCalledWith('data');
    expect(cb2).toHaveBeenCalledWith('data');
  });

  it('should auto-unsubscribe once after emit', () => {
    const callback = vi.fn();
    emitter.once('test', callback);
    emitter.emit('test', 'first');
    expect(callback).toHaveBeenCalledWith('first');
    emitter.emit('test', 'second');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should remove specific listener with off', () => {
    const callback = vi.fn();
    emitter.on('test', callback);
    emitter.off('test', callback);
    emitter.emit('test', 'payload');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should remove all listeners for an event', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on('test', cb1);
    emitter.on('test', cb2);
    emitter.removeAllListeners('test');
    emitter.emit('test', 'payload');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it('should remove all listeners globally', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on('event1', cb1);
    emitter.on('event2', cb2);
    emitter.removeAllListeners();
    emitter.emit('event1', 'payload');
    emitter.emit('event2', 'payload');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it('should count listeners correctly', () => {
    expect(emitter.listenerCount('test')).toBe(0);
    const cb1 = () => {};
    const cb2 = () => {};
    emitter.on('test', cb1);
    emitter.on('test', cb2);
    expect(emitter.listenerCount('test')).toBe(2);
    emitter.off('test', cb1);
    expect(emitter.listenerCount('test')).toBe(1);
  });

  it('should not crash on listener errors', () => {
    const errCallback = () => { throw new Error('fail'); };
    const goodCallback = vi.fn();
    emitter.on('test', errCallback);
    emitter.on('test', goodCallback);
    expect(() => emitter.emit('test')).not.toThrow();
    expect(goodCallback).toHaveBeenCalled();
  });
});
