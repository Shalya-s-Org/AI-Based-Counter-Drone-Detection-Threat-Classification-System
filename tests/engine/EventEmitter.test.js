import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../src/engine/EventEmitter.js';

describe('EventEmitter', () => {
  it('should register a listener and emit events', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();

    emitter.on('test-event', callback);
    emitter.emit('test-event', { data: 123 });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ data: 123 });
  });

  it('should allow unsubscribing via off', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();

    emitter.on('test-event', callback);
    emitter.off('test-event', callback);
    emitter.emit('test-event', { data: 123 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing via returned function', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();

    const unsubscribe = emitter.on('test-event', callback);
    unsubscribe();
    emitter.emit('test-event', { data: 123 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle once subscription', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();

    emitter.once('test-event', callback);
    emitter.emit('test-event', 'first');
    emitter.emit('test-event', 'second');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
  });

  it('should handle wildcard listeners', () => {
    const emitter = new EventEmitter();
    const callback = vi.fn();

    emitter.on('*', callback);
    emitter.emit('event-a', 'data-a');
    emitter.emit('event-b', 'data-b');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, { event: 'event-a', payload: 'data-a' });
    expect(callback).toHaveBeenNthCalledWith(2, { event: 'event-b', payload: 'data-b' });
  });

  it('should remove all listeners', () => {
    const emitter = new EventEmitter();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    emitter.on('event-a', callback1);
    emitter.on('event-b', callback2);
    emitter.removeAll();

    emitter.emit('event-a', 'data');
    emitter.emit('event-b', 'data');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
    expect(emitter.listenerCount()).toBe(0);
  });

  it('should remove listeners for a specific event', () => {
    const emitter = new EventEmitter();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    emitter.on('event-a', callback1);
    emitter.on('event-b', callback2);
    emitter.removeAll('event-a');

    emitter.emit('event-a', 'data');
    emitter.emit('event-b', 'data');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should track listener count correctly', () => {
    const emitter = new EventEmitter();
    const callback = () => {};

    emitter.on('event-a', callback);
    emitter.on('event-a', () => {});
    emitter.on('event-b', callback);
    emitter.on('*', callback);

    expect(emitter.listenerCount('event-a')).toBe(2);
    expect(emitter.listenerCount('event-b')).toBe(1);
    expect(emitter.listenerCount()).toBe(4); // 2 + 1 + 1 wildcard
  });
});
