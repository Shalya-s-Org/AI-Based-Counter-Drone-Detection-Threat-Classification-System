import { EVENT_TYPES, THREAT_LEVELS, TARGET_STATUSES, RADAR_CONFIG } from '../utils/constants.js';

export default class CameraFeed {
  constructor(container, eventEmitter) {
    this._container = container;
    this._emitter = eventEmitter;
    this._targets = new Map();
    this._selectedTargetId = null;
    this._channel = 'OPTICAL';

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this._container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'camera-header';
    header.innerHTML = `
      <div class="log-title">Camera Feed</div>
      <div class="channel-tabs">
        <button class="channel-tab active" data-channel="OPTICAL">Optical</button>
        <button class="channel-tab" data-channel="THERMAL">Thermal</button>
        <button class="channel-tab" data-channel="IR">IR</button>
      </div>
    `;

    this._viewport = document.createElement('div');
    this._viewport.className = 'camera-viewport';

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'camera-canvas';
    this._viewport.appendChild(this._canvas);

    const overlay = document.createElement('div');
    overlay.className = 'camera-overlay';
    overlay.innerHTML = `
      <div class="camera-scanline"></div>
      <div class="camera-crosshair"></div>
      <div class="camera-hud">
        <div class="camera-hud-left">
          <div>CH: <span id="cam-channel">OPTICAL</span></div>
          <div>ZOOM: <span id="cam-zoom">1.0x</span></div>
        </div>
        <div class="camera-hud-right">
          <div>AZ: <span id="cam-az">000°</span></div>
          <div>EL: <span id="cam-el">+00°</span></div>
        </div>
      </div>
      <div class="camera-bounding-box" id="cam-bbox" style="display:none;">
        <div class="camera-classification" id="cam-classification"></div>
      </div>
    `;

    this._viewport.appendChild(overlay);
    this._container.appendChild(header);
    this._container.appendChild(this._viewport);

    this._ctx = this._canvas.getContext('2d');
    this._elChannel = overlay.querySelector('#cam-channel');
    this._elZoom = overlay.querySelector('#cam-zoom');
    this._elAz = overlay.querySelector('#cam-az');
    this._elEl = overlay.querySelector('#cam-el');
    this._elBbox = overlay.querySelector('#cam-bbox');
    this._elClassification = overlay.querySelector('#cam-classification');

    for (const tab of header.querySelectorAll('.channel-tab')) {
      tab.addEventListener('click', () => {
        this._channel = tab.dataset.channel;
        for (const t of header.querySelectorAll('.channel-tab')) {
          t.classList.toggle('active', t === tab);
        }
        this._elChannel.textContent = this._channel;
        this._drawFeed();
      });
    }
  }

  _bindEvents() {
    this._emitter.on(EVENT_TYPES.TARGET_UPDATE, (targets) => {
      for (const t of targets) {
        this._targets.set(t.id, t);
      }
      this._updateBBox();
    });

    this._emitter.on(EVENT_TYPES.TARGET_SPAWN, (target) => {
      this._targets.set(target.id, target);
    });

    this._emitter.on(EVENT_TYPES.TARGET_DESTROY, (target) => {
      this._targets.delete(target.id);
      if (this._selectedTargetId === target.id) {
        this._selectedTargetId = null;
        this._updateBBox();
      }
    });

    this._emitter.on(EVENT_TYPES.TARGET_SELECT, ({ targetId }) => {
      this._selectedTargetId = targetId;
      this._updateBBox();
    });

    this._resizeObserver = new ResizeObserver(() => {
      this._resize();
      this._drawFeed();
    });
    this._resizeObserver.observe(this._viewport);
  }

  lockTarget(targetId) {
    this._selectedTargetId = targetId;
    this._updateBBox();
  }

  _resize() {
    const rect = this._viewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (this._canvas.width !== rect.width * dpr || this._canvas.height !== rect.height * dpr) {
      this._canvas.width = rect.width * dpr;
      this._canvas.height = rect.height * dpr;
      this._canvas.style.width = rect.width + 'px';
      this._canvas.style.height = rect.height + 'px';
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._width = rect.width;
      this._height = rect.height;
    }
  }

  _drawFeed() {
    if (!this._ctx || !this._width) return;
    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;

    ctx.clearRect(0, 0, w, h);

    if (this._channel === 'OPTICAL') {
      ctx.fillStyle = 'hsl(220, 20%, 6%)';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 60; i++) {
        const y = (Date.now() / 30 + i * 20) % h;
        ctx.fillStyle = 'hsla(120, 100%, 50%, 0.04)';
        ctx.fillRect(0, y, w, 1);
      }
    } else if (this._channel === 'THERMAL') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'hsla(0, 80%, 20%, 0.2)');
      grad.addColorStop(0.5, 'hsla(30, 80%, 30%, 0.2)');
      grad.addColorStop(1, 'hsla(0, 80%, 20%, 0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = 'hsla(120, 100%, 10%, 0.15)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'hsla(120, 100%, 50%, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      for (let i = 0; i < h; i += 8) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }
    }
  }

  _updateBBox() {
    if (!this._selectedTargetId) {
      this._elBbox.style.display = 'none';
      return;
    }

    const target = this._targets.get(this._selectedTargetId);
    if (!target) {
      this._elBbox.style.display = 'none';
      return;
    }

    const rect = this._viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const maxR = Math.min(cx, cy);
    const scale = maxR / RADAR_CONFIG.maxRange;

    const tx = cx + target.x * scale;
    const ty = cy + target.y * scale;

    const baseSize = Math.max(40, 200 - target.r * 0.15);
    const halfW = baseSize / 2;
    const halfH = baseSize / 2.6;

    const left = Math.max(0, tx - halfW);
    const top = Math.max(0, ty - halfH);
    const width = Math.min(rect.width - left, baseSize);
    const height = Math.min(rect.height - top, baseSize * 0.6);

    this._elBbox.style.display = 'block';
    this._elBbox.style.left = left + 'px';
    this._elBbox.style.top = top + 'px';
    this._elBbox.style.width = width + 'px';
    this._elBbox.style.height = height + 'px';

    const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;
    this._elBbox.className = 'camera-bounding-box ' + (target.threatLevel?.toLowerCase() || 'false-positive');

    const label = target.targetLabel || 'Unknown';
    const conf = Math.min(99, 60 + target.threatScore).toFixed(0);
    this._elClassification.textContent = `${target.id} | ${label} | ${conf}% | ${def.label}`;
    this._elClassification.style.color = def.color;
    this._elClassification.style.borderColor = def.color;

    this._elAz.textContent = ((target.theta * 180 / Math.PI) % 360).toFixed(0).padStart(3, '0') + '°';
    this._elEl.textContent = (target.altitude > 200 ? '+' : '') + (target.altitude / 10).toFixed(0).padStart(2, '0') + '°';
    this._elZoom.textContent = (1 + (RADAR_CONFIG.maxRange - target.r) / RADAR_CONFIG.maxRange * 2).toFixed(1) + 'x';
  }

  render() {
    this._resize();
    this._drawFeed();
  }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this._container.innerHTML = '';
  }
}
