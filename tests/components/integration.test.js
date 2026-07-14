import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { TargetManager } from '../../src/engine/TargetManager.js';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';
import Controls from '../../src/components/Controls.js';
import AlertLog from '../../src/components/AlertLog.js';
import TargetList from '../../src/components/TargetList.js';
import Radar from '../../src/components/Radar.js';
import CameraFeed from '../../src/components/CameraFeed.js';

function createContainer() {
  const el = document.createElement('div');
  el.style.width = '400px';
  el.style.height = '300px';
  document.body.appendChild(el);
  return el;
}

describe('Controls integration', () => {
  let container;
  let emitter;
  let targetManager;
  let controls;

  beforeEach(() => {
    container = createContainer();
    emitter = new EventEmitter();
    targetManager = new TargetManager(emitter);
    controls = new Controls(container, emitter, targetManager);
    controls.render();
  });

  it('should be disabled until target selected', () => {
    const buttons = container.querySelectorAll('.cm-button:not(.alarm)');
    buttons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('should enable buttons when target selected', () => {
    const target = targetManager.spawnTarget();
    emitter.emit('target:select', { targetId: target.id });
    const buttons = container.querySelectorAll('.cm-button:not(.alarm)');
    buttons.forEach((btn) => {
      expect(btn.disabled).toBe(false);
    });
  });

  it('should activate ALARM without target', () => {
    const handler = vi.fn();
    emitter.on('countermeasure:activate', handler);
    controls.activate('ALARM');
    expect(handler).toHaveBeenCalledWith({ type: 'ALARM', targetId: null });
  });

  it('should reject RF_JAM without target', () => {
    const handler = vi.fn();
    emitter.on('countermeasure:activate', handler);
    controls.activate('RF_JAM');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should show selected target info', () => {
    const target = targetManager.spawnTarget();
    emitter.emit('target:select', { targetId: target.id });
    const info = container.querySelector('.selected-target-info');
    expect(info.textContent).toContain(target.id);
  });
});

describe('AlertLog integration', () => {
  let container;
  let emitter;
  let alertLog;

  beforeEach(() => {
    container = createContainer();
    emitter = new EventEmitter();
    alertLog = new AlertLog(container, emitter);
    alertLog.render();
  });

  it('should show empty state initially', () => {
    expect(container.querySelector('.log-empty')).not.toBeNull();
  });

  it('should append entries on alert:log', () => {
    emitter.emit('alert:log', { level: 'INFO', message: 'Test event', timestamp: Date.now() });
    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Test event');
  });

  it('should filter entries by level', () => {
    emitter.emit('alert:log', { level: 'INFO', message: 'Info msg', timestamp: Date.now() });
    emitter.emit('alert:log', { level: 'CRITICAL', message: 'Critical msg', timestamp: Date.now() });
    const select = container.querySelector('#log-filter');
    select.value = 'CRITICAL';
    select.dispatchEvent(new Event('change'));
    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Critical msg');
  });

  it('should search entries by text', () => {
    emitter.emit('alert:log', { level: 'INFO', message: 'Alpha target', timestamp: Date.now() });
    emitter.emit('alert:log', { level: 'INFO', message: 'Beta target', timestamp: Date.now() });
    const search = container.querySelector('#log-search');
    search.value = 'Alpha';
    search.dispatchEvent(new Event('input'));
    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Alpha');
  });

  it('should clear entries', () => {
    emitter.emit('alert:log', { level: 'INFO', message: 'Msg', timestamp: Date.now() });
    const clearBtn = container.querySelector('#log-clear');
    clearBtn.click();
    expect(container.querySelectorAll('.log-entry').length).toBe(0);
  });
});

describe('TargetList integration', () => {
  let container;
  let emitter;
  let targetManager;
  let targetList;

  beforeEach(() => {
    container = createContainer();
    emitter = new EventEmitter();
    targetManager = new TargetManager(emitter);
    targetList = new TargetList(container, emitter);
    targetList.render();
  });

  it('should show target card on spawn', () => {
    const target = targetManager.spawnTarget();
    emitter.emit('target:spawn', target);
    expect(container.querySelectorAll('.target-card').length).toBe(1);
  });

  it('should remove card on destroy', () => {
    const target = targetManager.spawnTarget();
    emitter.emit('target:spawn', target);
    emitter.emit('target:destroy', target);
    expect(container.querySelectorAll('.target-card').length).toBe(0);
  });

  it('should highlight selected target', () => {
    const target = targetManager.spawnTarget();
    emitter.emit('target:spawn', target);
    emitter.emit('target:select', { targetId: target.id });
    const card = container.querySelector('.target-card');
    expect(card.classList.contains('selected')).toBe(true);
  });

  it('should filter targets by threat level', () => {
    const t1 = targetManager.spawnTarget();
    t1.threatLevel = 'CRITICAL';
    t1.threatScore = 90;
    const t2 = targetManager.spawnTarget();
    t2.threatLevel = 'FALSE_POSITIVE';
    t2.threatScore = 10;

    emitter.emit('target:spawn', t1);
    emitter.emit('target:spawn', t2);

    const filterBtn = container.querySelector('[data-filter="CRITICAL"]');
    filterBtn.click();
    const cards = container.querySelectorAll('.target-card');
    expect(cards.length).toBe(1);
    expect(cards[0].dataset.id).toBe(t1.id);
  });
});

describe('Radar integration', () => {
  let container;
  let emitter;
  let radar;

  beforeEach(() => {
    container = createContainer();
    emitter = new EventEmitter();
    radar = new Radar(container, emitter);
    radar.render();
  });

  it('should render canvas element', () => {
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('should track spawned targets', () => {
    const target = { id: 'T1', x: 100, y: 100, r: 100, theta: 0.5, v: 10, omega: 0.01, altitude: 100, rcs: 0.5, status: 'ACTIVE', threatScore: 50, threatLevel: 'WARNING', targetLabel: 'Drone' };
    emitter.emit('target:spawn', target);
    expect(radar._targets.size).toBe(1);
  });

  it('should clear tooltip on destroy', () => {
    const target = { id: 'T1', x: 100, y: 100, r: 100, theta: 0.5, v: 10, omega: 0.01, altitude: 100, rcs: 0.5, status: 'ACTIVE', threatScore: 50, threatLevel: 'WARNING', targetLabel: 'Drone' };
    emitter.emit('target:spawn', target);
    emitter.emit('target:destroy', target);
    expect(radar._targets.size).toBe(0);
  });
});

describe('CameraFeed integration', () => {
  let container;
  let emitter;
  let cameraFeed;

  beforeEach(() => {
    container = createContainer();
    emitter = new EventEmitter();
    cameraFeed = new CameraFeed(container, emitter);
    cameraFeed.render();
  });

  it('should render viewport and overlay', () => {
    expect(container.querySelector('.camera-viewport')).not.toBeNull();
    expect(container.querySelector('.camera-overlay')).not.toBeNull();
  });

  it('should switch channels', () => {
    const tabs = container.querySelectorAll('.channel-tab');
    expect(tabs.length).toBe(3);
    tabs[1].click();
    expect(tabs[1].classList.contains('active')).toBe(true);
  });

  it('should update bounding box on target update', () => {
    const target = { id: 'T1', x: 50, y: 50, r: 200, theta: 0.5, v: 10, omega: 0.01, altitude: 100, rcs: 0.5, status: 'ACTIVE', threatScore: 50, threatLevel: 'WARNING', targetLabel: 'Drone' };
    emitter.emit('target:update', [target]);
    emitter.emit('target:select', { targetId: 'T1' });
    const bbox = container.querySelector('.camera-bounding-box');
    expect(bbox.style.display).not.toBe('none');
  });
});
