/**
 * AeroGuard AI — Radar Component
 * Canvas 2D radar with 360° sweep, target blips, trajectories, and interaction.
 */

import { EVENTS, RADAR_CONFIG, THREAT_COLORS_RGB } from '../utils/constants.js';
import { polarToCartesian, radiansToDegrees, formatBearing } from '../utils/math.js';

export class Radar {
  /**
   * @param {HTMLElement} container
   * @param {import('../engine/EventEmitter.js').EventEmitter} eventBus
   */
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.targets = [];
    this.selectedTargetId = null;
    this.hoveredTarget = null;
    this.sweepAngle = 0;
    this.mousePos = { x: 0, y: 0 };

    // Radar center and radius (computed on resize)
    this.cx = 0;
    this.cy = 0;
    this.radius = 0;

    this.init();
    this.bindEvents();
    this._startRenderLoop();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'radar-panel glass-panel';
    this.el.style.gridArea = 'radar';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.overflow = 'hidden';

    this.el.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Situational Awareness (3D)</span>
        <div class="panel-actions">
          <button class="panel-action-btn"><i data-lucide="more-horizontal" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="radar-canvas-container" style="flex:1;min-height:0;position:relative;">
        <canvas class="radar-canvas" id="radar-canvas"></canvas>
        <div class="radar-overlay-tl" id="radar-overlay-tl">
          <div>AZ: <span class="radar-overlay-value" id="rov-az1">—</span></div>
          <div>AZ: <span class="radar-overlay-value" id="rov-az2">—</span></div>
          <div>EL: <span class="radar-overlay-value" id="rov-el1">—</span></div>
          <div>Range: <span class="radar-overlay-value" id="rov-range1">—</span></div>
        </div>
        <div class="radar-overlay-tr" id="radar-overlay-tr">
          <div>AZ: <span class="radar-overlay-value" id="rov-az3">—</span></div>
          <div>AZ: <span class="radar-overlay-value" id="rov-az4">—</span></div>
          <div>EL: <span class="radar-overlay-value" id="rov-el2">—</span></div>
          <div>Range: <span class="radar-overlay-value" id="rov-range2">—</span></div>
        </div>
      </div>
    `;

    this.container.appendChild(this.el);

    this.canvas = this.el.querySelector('#radar-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Lucide icons
    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });

    // Handle resize
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(this.canvas.parentElement);

    // Mouse interaction
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('click', (e) => this._onClick(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredTarget = null;
    });

    this._handleResize();
  }

  bindEvents() {
    this.eventBus.on(EVENTS.TARGET_UPDATE, ({ targets }) => {
      this.targets = targets;
    });

    this.eventBus.on(EVENTS.TARGET_SELECT, ({ targetId }) => {
      this.selectedTargetId = targetId;
    });

    this.eventBus.on(EVENTS.TARGET_DESTROY, ({ targetId }) => {
      if (this.selectedTargetId === targetId) {
        this.selectedTargetId = null;
      }
    });
  }

  _handleResize() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);

    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    this.cx = rect.width / 2;
    this.cy = rect.height / 2;
    this.radius = Math.min(this.cx, this.cy) * 0.85;
  }

  _startRenderLoop() {
    const render = () => {
      this._rafId = requestAnimationFrame(render);
      this._render();
    };
    render();
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    if (!w || !h) return;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    this._drawBackground(ctx, w, h);

    // Range rings
    this._drawRangeRings(ctx);

    // Compass labels
    this._drawCompass(ctx);

    // Sweep line
    this._drawSweep(ctx);

    // Target trails and blips
    this._drawTargets(ctx);

    // Hover tooltip
    this._drawTooltip(ctx);

    // Update sweep angle
    this.sweepAngle += RADAR_CONFIG.sweepSpeed;
    if (this.sweepAngle > Math.PI * 2) this.sweepAngle -= Math.PI * 2;

    // Update overlay readouts
    this._updateOverlays();
  }

  _drawBackground(ctx, w, h) {
    // Dark radial gradient background
    const grad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.radius * 1.2);
    grad.addColorStop(0, 'hsl(220, 30%, 10%)');
    grad.addColorStop(0.6, 'hsl(220, 30%, 7%)');
    grad.addColorStop(1, 'hsl(220, 30%, 4%)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid pattern
    ctx.strokeStyle = RADAR_CONFIG.gridColor;
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    const gridSpacing = 40;
    for (let y = this.cy % gridSpacing; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Vertical grid lines
    for (let x = this.cx % gridSpacing; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  _drawRangeRings(ctx) {
    const ringCount = RADAR_CONFIG.ringCount;

    for (let i = 1; i <= ringCount; i++) {
      const r = (this.radius / ringCount) * i;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = i === ringCount
        ? 'hsla(190, 80%, 50%, 0.2)'
        : 'hsla(190, 80%, 50%, 0.08)';
      ctx.lineWidth = i === ringCount ? 1.5 : 0.8;
      ctx.stroke();

      // Range label
      const label = RADAR_CONFIG.ringLabels[i - 1] || '';
      if (label) {
        ctx.fillStyle = 'hsla(190, 50%, 60%, 0.5)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, this.cx + r - 8, this.cy - 4);
      }
    }

    // Cross hairs
    ctx.strokeStyle = 'hsla(190, 80%, 50%, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(this.cx - this.radius, this.cy);
    ctx.lineTo(this.cx + this.radius, this.cy);
    ctx.moveTo(this.cx, this.cy - this.radius);
    ctx.lineTo(this.cx, this.cy + this.radius);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'hsla(190, 95%, 55%, 0.6)';
    ctx.fill();
  }

  _drawCompass(ctx) {
    const labels = ['N', 'E', 'S', 'W'];
    const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const compassR = this.radius + 18;

    ctx.font = '600 11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((label, i) => {
      const pos = polarToCartesian(compassR, angles[i], this.cx, this.cy);
      ctx.fillStyle = label === 'N'
        ? 'hsla(190, 95%, 65%, 0.9)'
        : 'hsla(190, 50%, 60%, 0.4)';
      ctx.fillText(label, pos.x, pos.y);
    });
  }

  _drawSweep(ctx) {
    // Sweep cone — draw multiple thin arcs with decreasing opacity
    const sweepWidth = 0.5; // radians
    const slices = 20;
    for (let i = 0; i < slices; i++) {
      const t = i / slices;
      const alpha = 0.12 * t * t; // quadratic fade-in
      const startAngle = this.sweepAngle - sweepWidth + (sweepWidth / slices) * i;
      const endAngle = startAngle + sweepWidth / slices + 0.01;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.arc(this.cx, this.cy, this.radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `hsla(190, 95%, 55%, ${alpha})`;
      ctx.fill();
    }

    // Sweep line
    const tipPos = polarToCartesian(this.radius, this.sweepAngle, this.cx, this.cy);
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(tipPos.x, tipPos.y);
    ctx.strokeStyle = 'hsla(190, 95%, 55%, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sweep tip glow
    ctx.beginPath();
    ctx.arc(tipPos.x, tipPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'hsla(190, 95%, 55%, 0.6)';
    ctx.fill();
  }

  _drawTargets(ctx) {
    for (const target of this.targets) {
      if (target.status === 'DESTROYED') continue;

      // Convert target position to screen coordinates
      const scale = this.radius / 1000; // RADAR_CONFIG.maxRange
      const sx = this.cx + target.x * scale;
      const sy = this.cy + target.y * scale;

      // Check if within radar bounds
      const dist = Math.sqrt((sx - this.cx) ** 2 + (sy - this.cy) ** 2);
      if (dist > this.radius * 1.05) continue;

      // Get threat color
      const tc = this._getThreatColorRGB(target.threatLevel);

      // Draw trail
      if (target.trail && target.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(this.cx + target.trail[0].x * scale, this.cy + target.trail[0].y * scale);
        for (let i = 1; i < target.trail.length; i++) {
          const tx = this.cx + target.trail[i].x * scale;
          const ty = this.cy + target.trail[i].y * scale;
          ctx.lineTo(tx, ty);
        }
        ctx.strokeStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.3)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrow head at end of trail
        if (target.trail.length >= 2) {
          const last = target.trail[target.trail.length - 1];
          const prev = target.trail[target.trail.length - 2];
          const ax = this.cx + last.x * scale;
          const ay = this.cy + last.y * scale;
          const angle = Math.atan2(
            (last.y - prev.y) * scale,
            (last.x - prev.x) * scale
          );
          this._drawArrowHead(ctx, ax, ay, angle, 6, `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.5)`);
        }
      }

      // Draw blip glow
      const glowR = target.threatLevel === 'CRITICAL' ? 16 : 10;
      const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      glowGrad.addColorStop(0, `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.3)`);
      glowGrad.addColorStop(1, `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);

      // Draw blip dot
      const blipR = target.threatLevel === 'CRITICAL' ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(sx, sy, blipR, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${tc.r}, ${tc.g}, ${tc.b})`;
      ctx.fill();

      // Selected ring
      const isSelected = this.selectedTargetId === target.id;
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Target label
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.9)`;
      ctx.textAlign = 'left';
      ctx.fillText(target.id, sx + 10, sy - 4);

      // Check hover
      if (this.hoveredTarget === target.id) {
        // Highlight ring
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.4)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Store screen position for hit-testing
      target._sx = sx;
      target._sy = sy;
    }
  }

  _drawArrowHead(ctx, x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2);
    ctx.lineTo(-size, size / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  _drawTooltip(ctx) {
    if (!this.hoveredTarget) return;

    const target = this.targets.find((t) => t.id === this.hoveredTarget);
    if (!target || !target._sx) return;

    const x = target._sx + 16;
    const y = target._sy - 30;

    const lines = [
      target.id,
      `Speed: ${target.speed.toFixed(1)} m/s`,
      `Alt: ${Math.round(target.altitude)} m`,
      `RCS: ${target.rcs.toFixed(2)} m²`,
      `Threat: ${target.threatScore}`,
    ];

    const lineHeight = 14;
    const padding = 8;
    const w = 140;
    const h = lines.length * lineHeight + padding * 2;

    // Background
    ctx.fillStyle = 'hsla(220, 30%, 10%, 0.92)';
    ctx.strokeStyle = 'hsla(190, 80%, 50%, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? 'hsl(190, 95%, 65%)' : 'hsl(210, 20%, 78%)';
      ctx.fillText(line, x + padding, y + padding + (i + 0.8) * lineHeight);
    });
  }

  _updateOverlays() {
    const selected = this.targets.find((t) => t.id === this.selectedTargetId);
    if (selected) {
      const az = radiansToDegrees(selected.theta).toFixed(1);
      const el = (selected.altitude / 10).toFixed(2);

      const tl = this.el.querySelector('#radar-overlay-tl');
      if (tl) {
        this.el.querySelector('#rov-az1').textContent = `${(-parseFloat(az) + 90).toFixed(1)}°`;
        this.el.querySelector('#rov-az2').textContent = `+${(parseFloat(az) * 0.044).toFixed(1)}°`;
        this.el.querySelector('#rov-el1').textContent = `-${el}°`;
        this.el.querySelector('#rov-range1').textContent = `${(selected.r * 0.0333).toFixed(1)} m`;
      }

      const tr = this.el.querySelector('#radar-overlay-tr');
      if (tr) {
        this.el.querySelector('#rov-az3').textContent = `${(-parseFloat(az) + 180).toFixed(1)}°`;
        this.el.querySelector('#rov-az4').textContent = `+${(parseFloat(az) * 0.93).toFixed(1)}°`;
        this.el.querySelector('#rov-el2').textContent = `-${(parseFloat(el) * 1.2).toFixed(2)}°`;
        this.el.querySelector('#rov-range2').textContent = `${(selected.r * 0.023).toFixed(1)} m`;
      }
    }
  }

  _getThreatColorRGB(level) {
    return THREAT_COLORS_RGB[level] || THREAT_COLORS_RGB.LOW;
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;

    // Hit test targets
    this.hoveredTarget = null;
    for (const target of this.targets) {
      if (!target._sx) continue;
      const dx = this.mousePos.x - target._sx;
      const dy = this.mousePos.y - target._sy;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        this.hoveredTarget = target.id;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    this.canvas.style.cursor = 'default';
  }

  _onClick(e) {
    if (this.hoveredTarget) {
      this.selectedTargetId = this.hoveredTarget;
      this.eventBus.emit(EVENTS.TARGET_SELECT, { targetId: this.hoveredTarget });
      import('../utils/audio.js').then((m) => m.playSelectSound());
    }
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.el.remove();
  }
}
