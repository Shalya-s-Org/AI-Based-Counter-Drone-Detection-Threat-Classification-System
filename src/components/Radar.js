import { RADAR_CONFIG, EVENT_TYPES, THREAT_LEVELS, TARGET_STATUSES } from '../utils/constants.js';
import { polarToCartesian } from '../utils/math.js';

const TRAIL_LENGTH = 36;
const PAD = 10;
const HIT_RADIUS = 12;
const VECTOR_LEAD = 4;

export default class Radar {
  constructor(container, eventEmitter) {
    this._container = container;
    this._emitter = eventEmitter;

    this._targets = new Map();
    this._trails = new Map();
    this._selectedTargetId = null;
    this._hoveredTargetId = null;

    this._sweepAngle = 0;
    this._sweepSpeed = (RADAR_CONFIG.sweepRPM * 2 * Math.PI) / 60;
    this._animFrameId = null;
    this._lastTime = 0;
    this._width = 0;
    this._height = 0;

    this._buildDOM();
    this._bindEvents();

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this._container);
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

    this._staticCanvas = document.createElement('canvas');
    this._staticCtx = this._staticCanvas.getContext('2d');
    this._staticDirty = true;

    const corners = ['tl', 'tr', 'bl', 'br'];
    for (const pos of corners) {
      const corner = document.createElement('div');
      corner.className = 'corner-bracket ' + pos;
      this._wrapper.appendChild(corner);
    }
  }

  _bindEvents() {
    this._emitter.on(EVENT_TYPES.TARGET_SPAWN, (target) => {
      this._targets.set(target.id, target);
      this._trails.set(target.id, []);
    });

    this._emitter.on(EVENT_TYPES.TARGET_UPDATE, (targets) => {
      for (const t of targets) {
        this._targets.set(t.id, t);
        const trail = this._trails.get(t.id);
        if (trail) {
          trail.push({ x: t.x, y: t.y });
          if (trail.length > TRAIL_LENGTH) trail.shift();
        }
      }
    });

    this._emitter.on(EVENT_TYPES.TARGET_DESTROY, (target) => {
      this._targets.delete(target.id);
      this._trails.delete(target.id);
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
    const { cx, cy, scale } = this._geometry();

    let closest = null;
    let closestDist = Infinity;

    for (const target of this._targets.values()) {
      const tx = cx + target.x * scale;
      const ty = cy + target.y * scale;
      const dist = Math.hypot(x - tx, y - ty);

      if (dist < HIT_RADIUS && dist < closestDist) {
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
    const range = Math.hypot(target.x, target.y);
    const bearing = (Math.atan2(target.x, -target.y) * 180 / Math.PI + 360) % 360;
    const vx = target.v * Math.cos(target.theta) - target.r * target.omega * Math.sin(target.theta);
    const vy = target.v * Math.sin(target.theta) + target.r * target.omega * Math.cos(target.theta);
    const heading = (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360;

    this._tooltip.innerHTML = `
      <div class="tooltip-header" style="color:${def.color}">${target.id}</div>
      <div class="tooltip-row"><span class="tooltip-label">Type</span><span class="tooltip-value">${target.targetLabel || 'Unknown'}</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Speed</span><span class="tooltip-value">${Math.abs(target.v).toFixed(1)} m/s</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Altitude</span><span class="tooltip-value">${target.altitude.toFixed(0)} m</span></div>
      <div class="tooltip-row"><span class="tooltip-label">RCS</span><span class="tooltip-value">${target.rcs.toFixed(2)} m²</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Range</span><span class="tooltip-value">${range.toFixed(0)} m</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Bearing</span><span class="tooltip-value">${bearing.toFixed(0).padStart(3, '0')}°</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Heading</span><span class="tooltip-value">${heading.toFixed(0).padStart(3, '0')}°</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Threat</span><span class="tooltip-value" style="color:${def.color}">${target.threatScore.toFixed(1)} — ${def.label}</span></div>
      <div class="tooltip-row"><span class="tooltip-label">Status</span><span class="tooltip-value">${target.status}</span></div>
    `;

    const wrapperRect = this._wrapper.getBoundingClientRect();
    let left = clientX - wrapperRect.left + 14;
    let top = clientY - wrapperRect.top - 10;

    if (left + 210 > wrapperRect.width) left = clientX - wrapperRect.left - 210;
    if (top + 200 > wrapperRect.height) top = clientY - wrapperRect.top - 200;

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

  _geometry() {
    const cx = this._width / 2;
    const cy = this._height / 2;
    const maxR = Math.max(0, Math.min(cx, cy) - PAD);
    const scale = maxR / RADAR_CONFIG.maxRange;
    return { cx, cy, maxR, scale };
  }

  _resize() {
    const rect = this._container.getBoundingClientRect();
    const size = Math.max(0, Math.min(rect.width, rect.height));
    const dpr = window.devicePixelRatio || 1;
    if (size === 0) return;

    const w = Math.round(size * dpr);
    if (this._canvas.width !== w) {
      this._wrapper.style.width = size + 'px';
      this._wrapper.style.height = size + 'px';

      this._canvas.width = w;
      this._canvas.height = w;
      this._canvas.style.width = size + 'px';
      this._canvas.style.height = size + 'px';
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._width = size;
      this._height = size;

      this._staticCanvas.width = w;
      this._staticCanvas.height = w;
      this._staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._staticDirty = true;
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
    this._resize();
    if (!this._width || !this._height) return;

    const ctx = this._ctx;
    const { cx, cy, maxR, scale } = this._geometry();

    ctx.clearRect(0, 0, this._width, this._height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.clip();

    if (this._staticDirty) {
      this._staticCtx.clearRect(0, 0, this._width, this._height);
      this._drawBackground(this._staticCtx, cx, cy, maxR);
      this._staticDirty = false;
    }

    ctx.drawImage(this._staticCanvas, 0, 0, this._width, this._height);

    this._drawTrails(ctx, cx, cy, scale);
    this._drawSweep(ctx, cx, cy, maxR);
    this._drawBlips(ctx, cx, cy, scale);
    this._drawSelection(ctx, cx, cy, maxR, scale);

    ctx.restore();

    this._drawCardinals(ctx, cx, cy, maxR);
  }

  _drawBackground(ctx, cx, cy, maxR) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    grad.addColorStop(0, 'hsl(220, 25%, 8%)');
    grad.addColorStop(1, 'hsl(220, 35%, 3%)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'hsla(210, 60%, 45%, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= RADAR_CONFIG.rings; i++) {
      const r = (maxR / RADAR_CONFIG.rings) * i;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'hsla(210, 60%, 40%, 0.10)';
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR);
      ctx.stroke();
    }

    ctx.strokeStyle = 'hsla(210, 70%, 55%, 0.25)';
    ctx.lineWidth = 1;
    for (let a = 0; a < 360; a += 15) {
      const ang = (a - 90) * Math.PI / 180;
      const len = a % 90 === 0 ? 9 : 5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR);
      ctx.lineTo(cx + Math.cos(ang) * (maxR - len), cy + Math.sin(ang) * (maxR - len));
      ctx.stroke();
    }

    ctx.fillStyle = 'hsla(210, 20%, 50%, 0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '9px "JetBrains Mono", monospace';
    for (let i = 1; i <= RADAR_CONFIG.rings; i++) {
      const r = (maxR / RADAR_CONFIG.rings) * i;
      const dist = Math.round((RADAR_CONFIG.maxRange / RADAR_CONFIG.rings) * i);
      ctx.fillText(dist + 'm', cx, cy - r - 7);
    }

    ctx.fillStyle = 'hsla(210, 100%, 65%, 0.9)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx - 4, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'hsla(210, 100%, 65%, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'hsla(210, 80%, 60%, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawCardinals(ctx, cx, cy, maxR) {
    const lr = maxR - 14;
    ctx.fillStyle = 'hsla(210, 30%, 72%, 0.7)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - lr);
    ctx.fillText('S', cx, cy + lr);
    ctx.fillText('E', cx + lr, cy);
    ctx.fillText('W', cx - lr, cy);
  }

  _drawSweep(ctx, cx, cy, maxR) {
    const sweepGrad = ctx.createConicGradient(this._sweepAngle, cx, cy);
    sweepGrad.addColorStop(0, 'hsla(130, 100%, 55%, 0.22)');
    sweepGrad.addColorStop(0.1, 'hsla(130, 100%, 55%, 0.0)');
    sweepGrad.addColorStop(1, 'hsla(130, 100%, 55%, 0.0)');

    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'hsla(130, 100%, 62%, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this._sweepAngle) * maxR, cy + Math.sin(this._sweepAngle) * maxR);
    ctx.stroke();

    ctx.fillStyle = 'hsla(130, 100%, 80%, 0.95)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(this._sweepAngle) * maxR, cy + Math.sin(this._sweepAngle) * maxR, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawTrails(ctx, cx, cy, scale) {
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const target of this._targets.values()) {
      const trail = this._trails.get(target.id);
      if (!trail || trail.length < 2) continue;
      if (target.id !== this._selectedTargetId && target.id !== this._hoveredTargetId) continue;

      const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;
      const persist = this._blipPersistence(target);

      ctx.strokeStyle = this._hsla(def.color, 0.5 * persist);
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const px = cx + trail[i].x * scale;
        const py = cy + trail[i].y * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  _drawBlips(ctx, cx, cy, scale) {
    const maxR = Math.min(cx, cy) - PAD;

    for (const target of this._targets.values()) {
      const tx = cx + target.x * scale;
      const ty = cy + target.y * scale;

      if (tx < -20 || tx > this._width + 20 || ty < -20 || ty > this._height + 20) continue;

      const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;
      const isFocus = target.id === this._selectedTargetId || target.id === this._hoveredTargetId;
      const persist = isFocus ? 1 : this._blipPersistence(target);

      const size = target.status === TARGET_STATUSES.CRITICAL || target.rcs > 1 ? 5 : 3;

      ctx.fillStyle = this._hsla(def.color, 0.22 * persist);
      ctx.beginPath();
      ctx.arc(tx, ty, size + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this._hsla(def.color, persist);
      ctx.beginPath();
      ctx.arc(tx, ty, size, 0, Math.PI * 2);
      ctx.fill();

      if (target.threatLevel === 'CRITICAL' || isFocus) {
        ctx.strokeStyle = this._hsla(def.glow, 0.6 * persist);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tx, ty, size + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _drawSelection(ctx, cx, cy, maxR, scale) {
    if (!this._selectedTargetId) return;
    const target = this._targets.get(this._selectedTargetId);
    if (!target) return;

    const tx = cx + target.x * scale;
    const ty = cy + target.y * scale;
    const def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE;

    ctx.strokeStyle = 'hsla(210, 100%, 65%, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, target.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const nr = target.r + target.v * VECTOR_LEAD;
    const ntheta = target.theta + target.omega * VECTOR_LEAD;
    const proj = polarToCartesian(nr, ntheta);
    const px = cx + proj.x * scale;
    const py = cy + proj.y * scale;

    if (nr > 0 && nr < RADAR_CONFIG.maxRange * 1.1) {
      ctx.strokeStyle = 'hsla(210, 100%, 70%, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);

      const ang = Math.atan2(py - ty, px - tx);
      ctx.fillStyle = 'hsla(210, 100%, 70%, 0.9)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - Math.cos(ang - 0.4) * 6, py - Math.sin(ang - 0.4) * 6);
      ctx.lineTo(px - Math.cos(ang + 0.4) * 6, py - Math.sin(ang + 0.4) * 6);
      ctx.closePath();
      ctx.fill();
    }

    const b = 11;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    const brackets = [
      [tx - b, ty - b, 1, 1],
      [tx + b, ty - b, -1, 1],
      [tx - b, ty + b, 1, -1],
      [tx + b, ty + b, -1, -1],
    ];
    for (const [bx, by, sx, sy] of brackets) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + sx * 6, by);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by + sy * 6);
      ctx.stroke();
    }

    ctx.fillStyle = def.color;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const labelY = ty - b - 4 < 0 ? ty + b + 12 : ty - b - 4;
    ctx.fillText(target.id, tx + b + 4, labelY);
  }

  _blipPersistence(target) {
    const angleDiff = Math.atan2(target.y, target.x) - this._sweepAngle;
    const normalized = ((angleDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.max(0.12, 1 - (normalized / (Math.PI * 2)) * 0.9);
  }

  _hsla(hsl, alpha) {
    if (hsl.startsWith('hsla')) return hsl;
    return hsl.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
  }

  destroy() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }
}
