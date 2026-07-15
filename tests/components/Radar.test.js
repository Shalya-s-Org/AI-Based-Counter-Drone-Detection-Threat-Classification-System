import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Radar } from '../../src/components/Radar.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { EVENTS } from '../../src/utils/constants.js';

describe('Radar Component', () => {
  let eventBus;
  let container;
  let radar;

  beforeEach(() => {
    // Mock ResizeObserver
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // Mock Canvas Context
    HTMLCanvasElement.prototype.getContext = () => ({
      scale: vi.fn(),
      clearRect: vi.fn(),
      createRadialGradient: () => ({
        addColorStop: vi.fn()
      }),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      roundRect: vi.fn(),
      setLineDash: vi.fn(),
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventEmitter();
  });

  afterEach(() => {
    if (radar) radar.destroy();
    container.remove();
  });

  it('should initialize canvas element and layout overlays', () => {
    radar = new Radar(container, eventBus);

    expect(container.querySelector('.radar-panel')).toBeDefined();
    expect(container.querySelector('#radar-canvas')).toBeDefined();
    expect(container.querySelector('#rov-az1')).toBeDefined();
  });

  it('should update targets when target:update events occur', () => {
    radar = new Radar(container, eventBus);

    const sampleTargets = [
      { id: 'TGT-001', x: 100, y: 200, r: 223, theta: 1.1, threatLevel: 'LOW', status: 'ACTIVE', trail: [] }
    ];

    eventBus.emit(EVENTS.TARGET_UPDATE, { targets: sampleTargets });

    expect(radar.targets.length).toBe(1);
    expect(radar.targets[0].id).toBe('TGT-001');
  });

  it('should mark target as selected when target:select is received', () => {
    radar = new Radar(container, eventBus);

    eventBus.emit(EVENTS.TARGET_SELECT, { targetId: 'TGT-001' });

    expect(radar.selectedTargetId).toBe('TGT-001');
  });

  it('should clear selection if selected target is destroyed', () => {
    radar = new Radar(container, eventBus);
    radar.selectedTargetId = 'TGT-001';

    eventBus.emit(EVENTS.TARGET_DESTROY, { targetId: 'TGT-001' });

    expect(radar.selectedTargetId).toBeNull();
  });

  it('should detect hovered target when mouse moves close to target coordinates', () => {
    radar = new Radar(container, eventBus);

    // Mock target with mock screen coordinate values
    const target = {
      id: 'TGT-001',
      x: 100,
      y: 100,
      r: 141,
      theta: 0.78,
      threatLevel: 'LOW',
      status: 'ACTIVE',
      trail: [],
      _sx: 150, // mock screen coordinates
      _sy: 150,
    };
    radar.targets = [target];

    // Simulate mouse move directly over target (at 150, 150)
    const mockEvent = {
      clientX: 150,
      clientY: 150
    };
    // Mock getBoundingClientRect
    radar.canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 300,
      height: 300
    });

    radar._onMouseMove(mockEvent);

    expect(radar.hoveredTarget).toBe('TGT-001');
    expect(radar.canvas.style.cursor).toBe('pointer');
  });

  it('should select target and trigger select sound on click', async () => {
    radar = new Radar(container, eventBus);

    // Spy on eventBus emit
    const emitSpy = vi.spyOn(eventBus, 'emit');

    radar.hoveredTarget = 'TGT-001';
    
    // Simulate click
    radar._onClick({});

    expect(radar.selectedTargetId).toBe('TGT-001');
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.TARGET_SELECT, { targetId: 'TGT-001' });
  });
});
