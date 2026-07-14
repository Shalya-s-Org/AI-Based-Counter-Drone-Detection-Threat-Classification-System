import { RADAR_CONFIG, EVENT_TYPES, THREAT_LEVELS, TARGET_STATUSES } from '../utils/constants.js';

export default class Radar {
  constructor(container, eventEmitter) {
    this._container = container;
    this._emitter = eventEmitter;

    this._targets = new Map();
    this._selectedTargetId = null;
    this._hoveredTargetId = null;

    this._sweepAngle = 0;
    this._sweepSpeed = (RADAR_CONFIG.sweepRPM * 2 * Math.PI) / 60;
    this._animFrameId = null;
    this._lastTime = 0;

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this._container.innerHTML = '';

    this._wrapper = document.createElement('div');
    this._wrapper.className = 'radar-wrapper';

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'radar-canvas';
    this._wrapper.appendChild(this._canvas);

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'radar-tooltip';
    this._wrapper.appendChild(this._tooltip);

    this._container.appendChild(this._wrapper);
    this._ctx = this._canvas.getContext('2d');
  }

  _bindEvents() {
    this._emitter.on(EVENT_TYPES.TARGET_SPAWN, (target) => {
      this._targets.set(target.id, target);
    });

    this._emitter.on(EVENT_TYPES.TARGET_UPDATE, (targets) => {
      for (const t of targets) {
        this._targets.set(t.id, t);
      }
    });

    this._emitter.on(EVENT_TYPES.TARGET_DESTROY, (target) => {
      this._targets.delete(target.id);
      if (this._hoveredTargetId === target.id) {
        this._hoveredTargetId = null;
        this._tooltip.classList.remove('visible');
      }
    });

    this._emitter.on(EVENT_TYPES.TARGET_SELECT, ({ targetId }) => {
      this._selectedTargetId = targetId;
    });

    this._canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this._canvas.addEventListener('mouseleave', () => this._onMouseLeave());
    this._canvas.addEventListener('click', (e) => this._onClick(e));
  }

  _onMouseMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const maxR = Math.min(cx, cy);

    let closest = null;
    let closestDist = Infinity;

    for (const target of this._targets.values()) {
      const scale = maxR / RADAR_CONFIG.maxRange;
      const tx = cx + target.x * scale;
      const ty = cy + target.y * scale;
      const dist = Math.hypot(x - tx, y - ty);

      if (dist < 12 && dist < closestDist) {
        closestDist = dist;
        closest = target;
      }
    }

    if (closest) {
      this._hoveredTargetId = closest.id;
      this._showTooltip(closest, e.clientX, e.clientY);
    } else {
      this._hoveredTargetId = null;
      this._tooltip.classList.remove('visible');
    }
  }

  _onMouseLeave() {
    this._hoveredTargetId = null;
    this._tooltip.classList.remove('visible');
  }

  _onClick(e) {
    if (this._hoveredTargetId) {
      this._emitter.emit(EVENT_TYPES.TARGET_SELECT, { targetId: this._hoveredTargetId });
    } else {
      this._emitter.emit(EVENT_TYPES.TARGET_SELECT, { targetId: null });
    }
  }

  _showTooltip(target, clientX, clientY) {
    const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;
    this._tooltip.innerHTML = `
      <div class="tooltip-header" style="color:${def.color}">${target.id}</div>
      <div class="tooltip-row"><span class="tooltip-label">Type</span><span class="tooltip-value">${target.targetLabel || 'Unknown'}</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Speed</span><span class="tooltip-value">${Math.abs(target.v).toFixed(1)} m/s</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Altitude</span><span class="tooltip-value">${target.altitude.toFixed(0)} m</span></div>
      <div class="tooltip-row"><span class="tooltip-label">RCS</span><span class="tooltip-value">${target.rcs.toFixed(2)} m²</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Threat</span><span class="tooltip-value" style="color:${def.color}">${target.threatScore.toFixed(1)} — ${def.label}</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Status</span><span class="tooltip-value">${target.status}</span></div>
    `;

    const rect = this._canvas.getBoundingClientRect();
    const wrapperRect = this._wrapper.getBoundingClientRect();
    let left = clientX - wrapperRect.left + 12;
    let top = clientY - wrapperRect.top - 10;

    if (left + 200 > wrapperRect.width) left = clientX - wrapperRect.left - 200;
    if (top + 160 > wrapperRect.height) top = clientY - wrapperRect.top - 160;

    this._tooltip.style.left = left + 'px';
    this._tooltip.style.top = top + 'px';
    this._tooltip.classList.add('visible');
  }

  setSelectedTarget(targetId) {
    this._selectedTargetId = targetId;
  }

  render() {
    this._resize();
    this._lastTime = performance.now();
    this._tick(this._lastTime);
  }

  _resize() {
    const rect = this._container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    if (this._canvas.width !== w * dpr || this._canvas.height !== h * dpr) {
      this._canvas.width = w * dpr;
      this._canvas.height = h * dpr;
      this._canvas.style.width = w + 'px';
      this._canvas.style.height = h + 'px';
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._width = w;
      this._height = h;
    }
  }

  _tick(timestamp) {
    if (!this._container.isConnected) return;

    this._animFrameId = requestAnimationFrame((t) => this._tick(t));

    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.1);
    this._lastTime = timestamp;
    this._sweepAngle = (this._sweepAngle + this._sweepSpeed * dt) % (Math.PI * 2);

    this._draw();
  }

  _draw() {
    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 10;

    ctx.clearRect(0, 0, w, h);

    this._drawBackground(ctx, cx, cy, maxR);
    this._drawSweep(ctx, cx, cy, maxR);
    this._drawBlips(ctx, cx, cy, maxR);
    this._drawSelection(ctx, cx, cy, maxR);
  }

  _drawBackground(ctx, cx, cy, maxR) {
    ctx.fillStyle = 'hsl(220, 20%, 5%)';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'hsla(220, 40%, 30%, 0.3)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= RADAR_CONFIG.rings; i++) {
      const r = (maxR / RADAR_CONFIG.rings) * i;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    ctx.fillStyle = 'hsla(220, 15%, 65%, 0.7)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', cx, cy - maxR - 14);
    ctx.textBaseline = 'bottom';
    ctx.fillText('S', cx, cy + maxR + 14);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('W', cx - maxR - 14, cy);
    ctx.textAlign = 'right';
    ctx.fillText('E', cx + maxR + 14, cy);

    ctx.fillStyle = 'hsla(220, 15%, 45%, 0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= RADAR_CONFIG.rings; i++) {
      const r = (maxR / RADAR_CONFIG.rings) * i;
      const dist = Math.round((RADAR_CONFIG.maxRange / RADAR_CONFIG.rings) * i);
      ctx.fillText(dist + 'm', cx, cy - r - 8);
    }
  }

  _drawSweep(ctx, cx, cy, maxR) {
    const sweepGrad = ctx.createConicGradient(this._sweepAngle, cx, cy);
    sweepGrad.addColorStop(0, 'hsla(120, 100%, 50%, 0.25)');
    sweepGrad.addColorStop(0.12, 'hsla(120, 100%, 50%, 0.0)');
    sweepGrad.addColorStop(1, 'hsla(120, 100%, 50%, 0.0)');

    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'hsla(120, 100%, 50%, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this._sweepAngle) * maxR, cy + Math.sin(this._sweepAngle) * maxR);
    ctx.stroke();
  }

  _drawBlips(ctx, cx, cy, maxR) {
    const scale = maxR / RADAR_CONFIG.maxRange;

    for (const target of this._targets.values()) {
      const tx = cx + target.x * scale;
      const ty = cy + target.y * scale;

      if (tx < -20 || tx > this._width + 20 || ty < -20 || ty > this._height + 20) continue;

      const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;
      const angleDiff = Math.atan2(target.y, target.x) - this._sweepAngle;
      const normalizedAngle = ((angleDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const age = normalizedAngle / (Math.PI * 2);
      const alpha = Math.max(0.15, 1 - age * 0.85);

      ctx.fillStyle = def.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
      ctx.strokeStyle = def.glow.replace('0.3', String(alpha * 0.6));
      ctx.lineWidth = 1.5;

      const size = target.status === TARGET_STATUSES.CRITICAL || target.rcs > 1 ? 5 : 3;

      ctx.beginPath();
      ctx.arc(tx, ty, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (target.threatLevel === 'CRITICAL') {
        ctx.strokeStyle = def.glow.replace('0.3', String(alpha * 0.4));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tx, ty, size + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _drawSelection(ctx, cx, cy, maxR) {
    if (!this._selectedTargetId) return;
    const target = this._targets.get(this._selectedTargetId);
    if (!target) return;

    const scale = maxR / RADAR_CONFIG.maxRange;
    const tx = cx + target.x * scale;
    const ty = cy + target.y * scale;

    ctx.strokeStyle = 'hsla(210, 100%, 65%, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  destroy() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
    }
  }
}
