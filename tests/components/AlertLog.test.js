import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertLog } from '../../src/components/AlertLog.js';
import { EventEmitter } from '../../src/engine/EventEmitter.js';
import { EVENTS } from '../../src/utils/constants.js';

describe('AlertLog Component', () => {
  let eventBus;
  let container;
  let alertLog;

  beforeEach(() => {
    // Setup jsdom container
    container = document.createElement('div');
    document.body.appendChild(container);

    eventBus = new EventEmitter();

    // Mock localStorage
    localStorage.clear();
  });

  afterEach(() => {
    if (alertLog) alertLog.destroy();
    container.remove();
  });

  it('should initialize DOM structure and load empty logs initially', () => {
    alertLog = new AlertLog(container, eventBus);

    expect(container.querySelector('.alert-log-panel')).toBeDefined();
    expect(container.querySelector('#log-entries')).toBeDefined();
    expect(container.querySelectorAll('.log-entry').length).toBe(0);
  });

  it('should display persisted logs on load', () => {
    // Pre-populate localStorage
    const sampleLog = {
      level: 'INFO',
      message: 'System Initialized',
      timestamp: Date.now() - 10000,
    };
    localStorage.setItem('aeroguard_alert_logs', JSON.stringify([sampleLog]));

    alertLog = new AlertLog(container, eventBus);

    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].querySelector('.log-message').textContent).toBe('System Initialized');
  });

  it('should add entries dynamically on alert:log events', () => {
    alertLog = new AlertLog(container, eventBus);

    eventBus.emit(EVENTS.ALERT_LOG, {
      level: 'CRITICAL',
      message: 'Intruder detected in Sector 4',
      timestamp: Date.now(),
    });

    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].classList.contains('critical')).toBe(true);
    expect(entries[0].querySelector('.log-message').textContent).toBe('Intruder detected in Sector 4');

    // Verify localStorage has it
    const stored = JSON.parse(localStorage.getItem('aeroguard_alert_logs'));
    expect(stored.length).toBe(1);
    expect(stored[0].message).toBe('Intruder detected in Sector 4');
  });

  it('should add entries on threat reclassification events', () => {
    alertLog = new AlertLog(container, eventBus);

    eventBus.emit(EVENTS.THREAT_RECLASSIFY, {
      targetId: 'TGT-001',
      oldLevel: 'LOW',
      newLevel: 'CRITICAL',
      score: 95,
    });

    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].classList.contains('critical')).toBe(true);
    expect(entries[0].querySelector('.log-message').textContent).toContain('TGT-001 reclassified: LOW → CRITICAL');
  });

  it('should clear all logs when the clear button is clicked', async () => {
    // Pre-populate logs
    localStorage.setItem('aeroguard_alert_logs', JSON.stringify([
      { level: 'LOW', message: 'Low alert', timestamp: Date.now() }
    ]));

    alertLog = new AlertLog(container, eventBus);
    expect(container.querySelectorAll('.log-entry').length).toBe(1);

    const clearBtn = container.querySelector('#btn-clear-log');
    clearBtn.click();

    // We yield to let any dynamics finish if they were async imports
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(container.querySelectorAll('.log-entry').length).toBe(0);
    expect(localStorage.getItem('aeroguard_alert_logs')).toBeNull();
  });

  it('should limit log display list size to 50 max', () => {
    alertLog = new AlertLog(container, eventBus);

    // Emit 60 events
    for (let i = 1; i <= 60; i++) {
      eventBus.emit(EVENTS.ALERT_LOG, {
        level: 'INFO',
        message: `Alert number ${i}`,
        timestamp: Date.now(),
      });
    }

    const entries = container.querySelectorAll('.log-entry');
    expect(entries.length).toBe(50);
    // Oldest entries (e.g. Alert 1 to 10) should have been evicted.
    // The top (newest) displayed entry in DOM is Alert 60
    expect(entries[0].querySelector('.log-message').textContent).toBe('Alert number 60');
  });
});
