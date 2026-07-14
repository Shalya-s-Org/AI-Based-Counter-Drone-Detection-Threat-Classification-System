import { EventEmitter } from './engine/EventEmitter.js';
import { SimulationEngine } from './engine/SimulationEngine.js';
import HeaderBar from './components/HeaderBar.js';
import Radar from './components/Radar.js';
import CameraFeed from './components/CameraFeed.js';
import TargetList from './components/TargetList.js';
import Controls from './components/Controls.js';
import AlertLog from './components/AlertLog.js';

export default class App {
  constructor(container) {
    this._container = container;
    this._emitter = new EventEmitter();
    this._engine = new SimulationEngine(this._emitter);

    this._selectedTargetId = null;
    this._components = {};

    this._buildDOM();
  }

  init() {
    this._mountComponents();
    this._bindEvents();
    this._bindKeyboard();
    this._engine.start();
  }

  _buildDOM() {
    this._container.innerHTML = '';

    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard';

    dashboard.innerHTML = `
      <div class="header-area glass-panel">
        <div id="header-bar"></div>
      </div>
      <div class="radar-area glass-panel">
        <div id="radar-container" class="radar-container"></div>
      </div>
      <div class="camera-area glass-panel">
        <div id="camera-container" class="camera-container"></div>
      </div>
      <div class="targets-area glass-panel">
        <div id="targets-container" class="target-list-container"></div>
      </div>
      <div class="controls-log-area glass-panel">
        <div class="controls-log-wrapper">
          <div id="controls-container" class="controls-section"></div>
          <div id="alertlog-container" class="alert-log-section"></div>
        </div>
      </div>
    `;

    this._container.appendChild(dashboard);
    this._dashboard = dashboard;
  }

  _mountComponents() {
    this._components.headerBar = new HeaderBar(
      document.getElementById('header-bar'),
      this._emitter,
    );
    this._components.radar = new Radar(
      document.getElementById('radar-container'),
      this._emitter,
    );
    this._components.cameraFeed = new CameraFeed(
      document.getElementById('camera-container'),
      this._emitter,
    );
    this._components.targetList = new TargetList(
      document.getElementById('targets-container'),
      this._emitter,
    );
    this._components.controls = new Controls(
      document.getElementById('controls-container'),
      this._emitter,
      this._engine.getTargetManager(),
    );
    this._components.alertLog = new AlertLog(
      document.getElementById('alertlog-container'),
      this._emitter,
    );

    for (const comp of Object.values(this._components)) {
      comp.render();
    }
  }

  _bindEvents() {
    this._emitter.on('target:select', ({ targetId }) => {
      this._selectedTargetId = targetId;
      this._components.cameraFeed.lockTarget(targetId);
      this._components.controls.setSelectedTarget(targetId);
      this._components.targetList.setSelectedTarget(targetId);
      this._components.radar.setSelectedTarget(targetId);
    });

    this._emitter.on('engine:status', (stats) => {
      this._components.headerBar.updateStats(stats);
    });

    this._emitter.on('target:spawn', (target) => {
      this._components.alertLog.addEntry({
        level: 'INFO',
        message: `Target ${target.id} detected`,
        targetId: target.id,
      });
    });

    this._emitter.on('threat:reclassify', ({ target, previousLevel, newLevel }) => {
      this._components.alertLog.addEntry({
        level: newLevel === 'CRITICAL' ? 'CRITICAL' : newLevel === 'WARNING' ? 'WARNING' : 'INFO',
        message: `${target.id} reclassified: ${previousLevel} → ${newLevel}`,
        targetId: target.id,
      });
    });

    this._emitter.on('countermeasure:activate', ({ type, targetId, label }) => {
      this._components.alertLog.addEntry({
        level: 'WARNING',
        message: `${label} activated${targetId ? ` on ${targetId}` : ''}`,
        targetId,
      });
    });

    this._emitter.on('countermeasure:complete', ({ type, targetId, result }) => {
      this._components.alertLog.addEntry({
        level: result === 'HIT' ? 'SUCCESS' : 'INFO',
        message: `${type} ${result.toLowerCase()}${targetId ? ` — ${targetId}` : ''}`,
        targetId,
      });
    });

    this._emitter.on('target:destroy', (target) => {
      if (this._selectedTargetId === target.id) {
        this._selectedTargetId = null;
        this._components.cameraFeed.lockTarget(null);
        this._components.controls.setSelectedTarget(null);
      }
    });
  }

  _bindKeyboard() {
    this._keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this._engine.togglePause();
          break;
        case 'Digit1':
          this._components.controls.activate('RF_JAM');
          break;
        case 'Digit2':
          this._components.controls.activate('GPS_SPOOF');
          break;
        case 'Digit3':
          this._components.controls.activate('KINETIC');
          break;
        case 'Digit4':
          this._components.controls.activate('ALARM');
          break;
        case 'Escape':
          this._emitter.emit('target:select', { targetId: null });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', this._keyHandler);
  }

  destroy() {
    this._engine.stop();
    window.removeEventListener('keydown', this._keyHandler);
    for (const comp of Object.values(this._components)) {
      if (typeof comp.destroy === 'function') comp.destroy();
    }
  }
}
