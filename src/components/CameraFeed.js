/**
 * AeroGuard AI — CameraFeed Component
 * Multi-spectral PTZ camera viewport with bounding boxes and HUD overlay.
 */

import { EVENTS, THREAT_COLORS_RGB } from '../utils/constants.js';

export class CameraFeed {
  /**
   * @param {HTMLElement} container
   * @param {import('../engine/EventEmitter.js').EventEmitter} eventBus
   */
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.targets = [];
    this.selectedTargetId = null;
    this.activeChannel = 'optical';
    this.noiseData = null;

    this.init();
    this.bindEvents();
    this._startRenderLoop();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'camera-feed-panel glass-panel';

    this.el.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Multi-Spectral Camera Feed</span>
        <div class="panel-actions">
          <div class="channel-tabs">
            <button class="channel-tab active" data-channel="optical">Optical</button>
            <button class="channel-tab" data-channel="thermal">Thermal</button>
            <button class="channel-tab" data-channel="ir">IR</button>
          </div>
          <button class="panel-action-btn"><i data-lucide="more-horizontal" style="width:16px;height:16px"></i></button>
        </div>
      </div>
      <div class="camera-viewport">
        <canvas class="camera-canvas" id="camera-canvas"></canvas>
        <div class="camera-hud-overlay">
          <div class="camera-live-badge">
            <span class="live-indicator">LIVE</span>
          </div>
          <div class="camera-info-bl" id="camera-info"></div>
        </div>
      </div>
    `;

    this.container.appendChild(this.el);

    this.canvas = this.el.querySelector('#camera-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.cameraInfo = this.el.querySelector('#camera-info');

    // Channel tab switching
    const tabs = this.el.querySelectorAll('.channel-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeChannel = tab.dataset.channel;
        this.eventBus.emit(EVENTS.CAMERA_CHANNEL_SWITCH, { channel: this.activeChannel });
      });
    });

    if (window.lucide) window.lucide.createIcons({ nodes: [this.el] });

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(this.canvas.parentElement);
    this._handleResize();
  }

  bindEvents() {
    this.eventBus.on(EVENTS.TARGET_UPDATE, ({ targets }) => {
      this.targets = targets;
    });

    this.eventBus.on(EVENTS.TARGET_SELECT, ({ targetId }) => {
      this.selectedTargetId = targetId;
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

    this.w = rect.width;
    this.h = rect.height;

    // Generate noise texture
    this._generateNoise();
  }

  _generateNoise() {
    if (!this.w || !this.h) return;
    const imgData = this.ctx.createImageData(this.w, this.h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 15;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }

    this.noiseData = imgData;
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
    if (!this.w || !this.h) return;

    // Get target to focus on
    const target = this._getLockedTarget();

    // 1. Draw Scenic Terrain shifting with camera PTZ tracking
    this._drawTerrain(ctx, target);

    // 2. Draw Scan Lines
    this._drawScanLines(ctx);

    // 3. Draw locked target bounding box and details
    if (target) {
      this._drawBoundingBox(ctx, target);
      this._updateInfo(target);
    } else {
      this._drawNoSignal(ctx);
      this.cameraInfo.innerHTML = `
        <div style="color: var(--text-muted)">No target locked</div>
      `;
    }

    // 4. Draw HUD Overlays (pitch ladder, compass tape, grids)
    this._drawHUD(ctx, target);

    // 5. Draw Vignette
    this._drawVignette(ctx);
  }

  _drawTerrain(ctx, target) {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const now = Date.now();

    // Yaw/bearing is derived from target.theta
    const yaw = target ? (target.theta * 180 / Math.PI) : 0;
    // Pitch/elevation is derived from target.altitude and target.r
    const pitch = target ? Math.atan2(target.altitude, target.r) * 180 / Math.PI : 0;

    // Calculate background offsets for smooth PTZ panning
    // yawOffset controls horizontal scrolling, pitchOffset controls vertical horizon shifts
    const yawOffset = yaw * 5; 
    const pitchOffset = pitch * 3.5; 

    const horizonY = cy + pitchOffset + 20;

    ctx.save();

    // 1. Draw Sky Gradient
    let skyGrad = ctx.createLinearGradient(0, 0, 0, this.h);
    if (this.activeChannel === 'thermal') {
      skyGrad.addColorStop(0, 'hsl(0, 0%, 4%)');
      skyGrad.addColorStop(1, 'hsl(0, 0%, 12%)');
    } else if (this.activeChannel === 'ir') {
      skyGrad.addColorStop(0, 'hsl(120, 45%, 4%)');
      skyGrad.addColorStop(1, 'hsl(120, 30%, 10%)');
    } else {
      skyGrad.addColorStop(0, 'hsl(220, 45%, 6%)');
      skyGrad.addColorStop(0.7, 'hsl(218, 35%, 12%)');
      skyGrad.addColorStop(1, 'hsl(215, 25%, 18%)');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.w, this.h);

    // 2. Draw Stars (only in optical, subtle flicker)
    if (this.activeChannel === 'optical') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 15; i++) {
        const starX = ((i * 137 + yawOffset * 0.1) % this.w + this.w) % this.w;
        const starY = (i * 73) % Math.max(1, horizonY - 40);
        const size = 0.5 + Math.sin(now / 300 + i) * 0.4;
        if (starY > 0 && starY < horizonY - 20) {
          ctx.beginPath();
          ctx.arc(starX, starY, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Draw Horizon Mountains Silhouette
    // Layer 1: Distant Mountains (slower scroll)
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    for (let x = 0; x <= this.w; x += 15) {
      const hillH = Math.sin((x + yawOffset * 0.4) * 0.007) * 25 + 
                    Math.cos((x + yawOffset * 0.2) * 0.003) * 12;
      ctx.lineTo(x, horizonY - 45 + hillH);
    }
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    if (this.activeChannel === 'thermal') {
      ctx.fillStyle = 'hsl(0, 0%, 15%)';
    } else if (this.activeChannel === 'ir') {
      ctx.fillStyle = 'hsl(120, 20%, 8%)';
    } else {
      ctx.fillStyle = 'hsl(220, 20%, 8%)';
    }
    ctx.fill();

    // Layer 2: Nearer hills (faster scroll)
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    for (let x = 0; x <= this.w; x += 10) {
      const hillH = Math.sin((x + yawOffset * 0.95) * 0.015) * 15 + 
                    Math.cos((x + yawOffset * 0.6) * 0.008) * 8;
      ctx.lineTo(x, horizonY - 15 + hillH);
    }
    ctx.lineTo(this.w, this.h);
    ctx.closePath();
    if (this.activeChannel === 'thermal') {
      ctx.fillStyle = 'hsl(0, 0%, 20%)';
    } else if (this.activeChannel === 'ir') {
      ctx.fillStyle = 'hsl(120, 20%, 12%)';
    } else {
      ctx.fillStyle = 'hsl(220, 20%, 11%)';
    }
    ctx.fill();

    // 4. Draw ground plane
    ctx.fillStyle = this.activeChannel === 'thermal' ? 'hsl(0, 0%, 25%)'
                  : this.activeChannel === 'ir' ? 'hsl(120, 20%, 16%)'
                  : 'hsl(220, 20%, 14%)';
    ctx.fillRect(0, horizonY, this.w, Math.max(0, this.h - horizonY));

    ctx.restore();
  }

  _drawScanLines(ctx) {
    ctx.fillStyle = 'hsla(0, 0%, 100%, 0.015)';
    for (let y = 0; y < this.h; y += 3) {
      ctx.fillRect(0, y, this.w, 1);
    }
  }

  _drawVignette(ctx) {
    ctx.save();
    const vigGrad = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    
    if (this.activeChannel === 'thermal') {
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    } else if (this.activeChannel === 'ir') {
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(1, 'rgba(0, 15, 0, 0.65)');
    } else {
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    }
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  _drawBoundingBox(ctx, target) {
    const tc = THREAT_COLORS_RGB[target.threatLevel] || THREAT_COLORS_RGB.LOW;

    // Compute bounding box based on distance
    const maxR = 1000;
    const distFactor = Math.max(0.2, 1 - target.r / maxR);
    const boxW = 60 + distFactor * 100;
    const boxH = boxW * 0.75;

    // Small camera tracking jitter/oscillation to represent wind/gimbal vibrations
    const bx = this.w / 2 - boxW / 2 + Math.sin(Date.now() / 800) * 3;
    const by = this.h / 2 - boxH / 2 + Math.cos(Date.now() / 900) * 2;

    // Bounding box corners
    const cornerLen = 12;
    ctx.save();
    ctx.strokeStyle = `rgb(${tc.r}, ${tc.g}, ${tc.b})`;
    ctx.lineWidth = 1.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + cornerLen);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cornerLen, by);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(bx + boxW - cornerLen, by);
    ctx.lineTo(bx + boxW, by);
    ctx.lineTo(bx + boxW, by + cornerLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bx, by + boxH - cornerLen);
    ctx.lineTo(bx, by + boxH);
    ctx.lineTo(bx + cornerLen, by + boxH);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bx + boxW - cornerLen, by + boxH);
    ctx.lineTo(bx + boxW, by + boxH);
    ctx.lineTo(bx + boxW, by + boxH - cornerLen);
    ctx.stroke();

    // Corner bracket locks inside the box (flashing visual tracker)
    const lockMargin = 8;
    ctx.strokeStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.4)' 
                    : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.4)'
                    : `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.4)`;
    ctx.lineWidth = 1;
    // Top-Left inner
    ctx.beginPath();
    ctx.moveTo(bx + lockMargin, by + lockMargin + 4);
    ctx.lineTo(bx + lockMargin, by + lockMargin);
    ctx.lineTo(bx + lockMargin + 4, by + lockMargin);
    ctx.stroke();
    // Top-Right inner
    ctx.beginPath();
    ctx.moveTo(bx + boxW - lockMargin, by + lockMargin + 4);
    ctx.lineTo(bx + boxW - lockMargin, by + lockMargin);
    ctx.lineTo(bx + boxW - lockMargin - 4, by + lockMargin);
    ctx.stroke();
    // Bottom-Left inner
    ctx.beginPath();
    ctx.moveTo(bx + lockMargin, by + boxH - lockMargin - 4);
    ctx.lineTo(bx + lockMargin, by + boxH - lockMargin);
    ctx.lineTo(bx + lockMargin + 4, by + boxH - lockMargin);
    ctx.stroke();
    // Bottom-Right inner
    ctx.beginPath();
    ctx.moveTo(bx + boxW - lockMargin, by + boxH - lockMargin - 4);
    ctx.lineTo(bx + boxW - lockMargin, by + boxH - lockMargin);
    ctx.lineTo(bx + boxW - lockMargin - 4, by + boxH - lockMargin);
    ctx.stroke();

    // Target ID label above bounding box
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = `rgb(${tc.r}, ${tc.g}, ${tc.b})`;
    ctx.textAlign = 'left';
    ctx.fillText(`${target.id} | ${target.threatLabel || target.type}`, bx, by - 8);

    // Confidence score
    const confidence = Math.min(99, 60 + target.threatScore * 0.4);
    ctx.textAlign = 'right';
    ctx.fillText(`${confidence.toFixed(0)}%`, bx + boxW, by - 8);

    ctx.restore();

    // Simulated drone silhouette inside box
    this._drawDroneSilhouette(ctx, bx + boxW / 2, by + boxH / 2, distFactor, tc);
  }

  _drawDroneSilhouette(ctx, cx, cy, scale, tc) {
    const s = (12 + scale * 25); // base size
    const now = Date.now();

    ctx.save();
    
    // Smooth translation to drone position
    ctx.translate(cx, cy);

    if (this.activeChannel === 'thermal') {
      // Draw heat plume / thermal drift behind the drone
      const plumeLen = s * 2.2;
      const plumeGrad = ctx.createLinearGradient(0, 0, 0, plumeLen);
      plumeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      plumeGrad.addColorStop(0.2, 'rgba(255, 140, 0, 0.4)');
      plumeGrad.addColorStop(0.6, 'rgba(255, 50, 0, 0.15)');
      plumeGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');

      ctx.save();
      // Heat plume rises slightly and drifts with simulated relative wind
      ctx.rotate(Math.PI + Math.sin(now / 150) * 0.05); 
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, 0);
      ctx.quadraticCurveTo(-s * 0.4, plumeLen * 0.5, -s * 0.6, plumeLen);
      ctx.lineTo(s * 0.6, plumeLen);
      ctx.quadraticCurveTo(s * 0.4, plumeLen * 0.5, s * 0.15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Main frame - white hot body
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;

      // Draw chassis
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.4, s * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw arms
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.5);
      ctx.lineTo(s * 0.7, s * 0.5);
      ctx.moveTo(s * 0.7, -s * 0.5);
      ctx.lineTo(-s * 0.7, s * 0.5);
      ctx.stroke();

      // Draw motor heat glow at the arm tips
      const armCoords = [
        [-s * 0.7, -s * 0.5],
        [s * 0.7, -s * 0.5],
        [-s * 0.7, s * 0.5],
        [s * 0.7, s * 0.5]
      ];
      
      armCoords.forEach(([ax, ay]) => {
        // Motor hub
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(ax, ay, s * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Intense radial thermal glow
        const radGrad = ctx.createRadialGradient(ax, ay, 0, ax, ay, s * 0.45);
        radGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radGrad.addColorStop(0.2, 'rgba(255, 230, 0, 0.95)');
        radGrad.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
        radGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(ax, ay, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (this.activeChannel === 'ir') {
      // Infrared green night vision mode
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.9)';
      ctx.fillStyle = 'rgba(20, 100, 20, 0.5)';
      ctx.lineWidth = 1.5;

      // Chassis
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.45, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Arms & landing gear
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.5);
      ctx.lineTo(s * 0.7, s * 0.5);
      ctx.moveTo(s * 0.7, -s * 0.5);
      ctx.lineTo(-s * 0.7, s * 0.5);
      // Landing gear
      ctx.moveTo(-s * 0.25, s * 0.2);
      ctx.lineTo(-s * 0.35, s * 0.65);
      ctx.lineTo(-s * 0.5, s * 0.65);
      ctx.moveTo(s * 0.25, s * 0.2);
      ctx.lineTo(s * 0.35, s * 0.65);
      ctx.lineTo(s * 0.5, s * 0.65);
      ctx.stroke();

      // Rotors
      const armCoords = [
        [-s * 0.7, -s * 0.5],
        [s * 0.7, -s * 0.5],
        [-s * 0.7, s * 0.5],
        [s * 0.7, s * 0.5]
      ];
      
      armCoords.forEach(([ax, ay]) => {
        // Motor mount
        ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
        ctx.beginPath();
        ctx.arc(ax, ay, s * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Spin blur
        ctx.strokeStyle = 'rgba(100, 255, 100, 0.35)';
        ctx.beginPath();
        ctx.ellipse(ax, ay, s * 0.35, s * 0.08, now / 50, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Active IR Strobe Beacon (flashing green)
      if (Math.floor(now / 100) % 6 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(0, -s * 0.2, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        const beaconGlow = ctx.createRadialGradient(0, -s * 0.2, 0, 0, -s * 0.2, s * 0.8);
        beaconGlow.addColorStop(0, 'rgba(100, 255, 100, 1)');
        beaconGlow.addColorStop(0.3, 'rgba(100, 255, 100, 0.6)');
        beaconGlow.addColorStop(1, 'rgba(0, 255, 0, 0)');
        ctx.fillStyle = beaconGlow;
        ctx.beginPath();
        ctx.arc(0, -s * 0.2, s * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

    } else {
      // Optical mode - realistic high contrast grey drone silhouette
      ctx.fillStyle = 'rgba(25, 30, 38, 0.95)';
      ctx.strokeStyle = 'rgba(10, 12, 16, 1)';
      ctx.lineWidth = 1.5;

      // Camera lens on the front
      ctx.save();
      ctx.fillStyle = 'rgba(40, 50, 70, 1)';
      ctx.beginPath();
      ctx.arc(s * 0.28, 0, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Body / Chassis
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.42, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Arms
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.5);
      ctx.lineTo(s * 0.7, s * 0.5);
      ctx.moveTo(s * 0.7, -s * 0.5);
      ctx.lineTo(-s * 0.7, s * 0.5);
      
      // Landing skids
      ctx.moveTo(-s * 0.25, s * 0.2);
      ctx.lineTo(-s * 0.35, s * 0.65);
      ctx.lineTo(-s * 0.5, s * 0.65);
      ctx.moveTo(s * 0.25, s * 0.2);
      ctx.lineTo(s * 0.35, s * 0.65);
      ctx.lineTo(s * 0.5, s * 0.65);
      ctx.stroke();

      // Rotors
      const armCoords = [
        [-s * 0.7, -s * 0.5],
        [s * 0.7, -s * 0.5],
        [-s * 0.7, s * 0.5],
        [s * 0.7, s * 0.5]
      ];
      
      armCoords.forEach(([ax, ay], idx) => {
        // Motor caps
        ctx.fillStyle = 'rgba(70, 75, 80, 1)';
        ctx.beginPath();
        ctx.arc(ax, ay, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Spin blur
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ax, ay, s * 0.34, s * 0.07, now / 40 + idx * Math.PI/2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Blinking Navigation Lights (Red left, Green right, Strobe tail)
      ctx.save();
      const leftBlink = Math.floor(now / 400) % 2 === 0;
      const rightBlink = Math.floor(now / 400) % 2 === 1;
      const tailBlink = Math.floor(now / 150) % 4 === 0;

      if (leftBlink) {
        ctx.fillStyle = 'rgb(255, 50, 50)';
        ctx.beginPath();
        ctx.arc(-s * 0.7, -s * 0.5, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      if (rightBlink) {
        ctx.fillStyle = 'rgb(50, 255, 50)';
        ctx.beginPath();
        ctx.arc(s * 0.7, -s * 0.5, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tailBlink) {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.beginPath();
        ctx.arc(-s * 0.42, 0, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _drawHUD(ctx, target) {
    const cx = this.w / 2;
    const cy = this.h / 2;

    // 1. Attitude Indicator (Pitch Ladder)
    const pitch = target ? Math.atan2(target.altitude, target.r) * 180 / Math.PI : 0;
    const pitchOffset = pitch * 4.5;
    const startPitch = Math.floor((pitch - 15) / 5) * 5;
    const endPitch = Math.ceil((pitch + 15) / 5) * 5;

    ctx.save();
    ctx.strokeStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.25)' 
                    : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.25)'
                    : 'rgba(55, 220, 255, 0.25)';
    ctx.fillStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.45)' 
                  : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.45)'
                  : 'rgba(55, 220, 255, 0.45)';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.lineWidth = 1;

    for (let p = startPitch; p <= endPitch; p += 5) {
      if (p === 0) continue;
      const y = cy + (pitch - p) * 4.5;
      if (y > cy - 80 && y < cy + 80) {
        ctx.beginPath();
        // Left bracket
        ctx.moveTo(cx - 35, y);
        ctx.lineTo(cx - 15, y);
        ctx.lineTo(cx - 15, y + (p > 0 ? 4 : -4));
        // Right bracket
        ctx.moveTo(cx + 35, y);
        ctx.lineTo(cx + 15, y);
        ctx.lineTo(cx + 15, y + (p > 0 ? 4 : -4));
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillText(`${p}`, cx - 40, y + 2.5);
        ctx.textAlign = 'left';
        ctx.fillText(`${p}`, cx + 40, y + 2.5);
      }
    }
    ctx.restore();

    // 2. Scrolling Compass Tape
    const heading = target ? (target.theta * 180 / Math.PI + 360) % 360 : 0;
    const compassY = 32;
    ctx.save();
    ctx.strokeStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.35)' 
                    : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.35)'
                    : 'rgba(55, 220, 255, 0.35)';
    ctx.fillStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.7)' 
                  : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.7)'
                  : 'rgba(55, 220, 255, 0.7)';
    ctx.lineWidth = 1;

    // Outer tape line
    ctx.beginPath();
    ctx.moveTo(cx - 120, compassY);
    ctx.lineTo(cx + 120, compassY);
    ctx.stroke();

    // Index pointer arrow
    ctx.beginPath();
    ctx.moveTo(cx, compassY);
    ctx.lineTo(cx - 4, compassY - 6);
    ctx.lineTo(cx + 4, compassY - 6);
    ctx.closePath();
    ctx.fill();

    // Ticks & Labels
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let offset = -180; offset <= 180; offset += 5) {
      const tickHeading = (Math.round(heading) + offset + 360) % 360;
      const tickX = cx + offset * 1.5;
      if (tickX > cx - 120 && tickX < cx + 120) {
        const isMajor = tickHeading % 10 === 0;
        ctx.beginPath();
        ctx.moveTo(tickX, compassY);
        ctx.lineTo(tickX, compassY + (isMajor ? 6 : 3));
        ctx.stroke();

        if (isMajor) {
          let label = String(tickHeading).padStart(3, '0');
          if (tickHeading === 0) label = 'N';
          else if (tickHeading === 90) label = 'E';
          else if (tickHeading === 180) label = 'S';
          else if (tickHeading === 270) label = 'W';
          ctx.fillText(label, tickX, compassY - 8);
        }
      }
    }
    ctx.restore();

    // 3. Central Reticle / Brackets
    ctx.save();
    ctx.strokeStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.4)' 
                    : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.4)'
                    : 'rgba(55, 220, 255, 0.4)';
    ctx.lineWidth = 1.5;

    // Crosshair Lines
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Corner framing guides
    const cornerSize = 10;
    const margin = 16;
    ctx.lineWidth = 1;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(margin, margin + cornerSize);
    ctx.lineTo(margin, margin);
    ctx.lineTo(margin + cornerSize, margin);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(this.w - margin, margin + cornerSize);
    ctx.lineTo(this.w - margin, margin);
    ctx.lineTo(this.w - margin - cornerSize, margin);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(margin, this.h - margin - cornerSize);
    ctx.lineTo(margin, this.h - margin);
    ctx.lineTo(margin + cornerSize, this.h - margin);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(this.w - margin, this.h - margin - cornerSize);
    ctx.lineTo(this.w - margin, this.h - margin);
    ctx.lineTo(this.w - margin - cornerSize, this.h - margin);
    ctx.stroke();
    ctx.restore();

    // 4. Dynamic Tracking Status & Overlay Metadata
    ctx.save();
    ctx.fillStyle = this.activeChannel === 'ir' ? 'rgba(100, 255, 100, 0.7)' 
                  : this.activeChannel === 'thermal' ? 'rgba(255, 255, 255, 0.7)'
                  : 'rgba(55, 220, 255, 0.7)';
    ctx.font = '600 8.5px "JetBrains Mono", monospace';
    
    // Zoom factor based on target range
    let zoomVal = '1.0X';
    if (target) {
      if (target.r < 300) zoomVal = '8.0X';
      else if (target.r < 600) zoomVal = '4.0X';
      else zoomVal = '2.0X';
    }

    // Top-Left corner HUD values
    ctx.textAlign = 'left';
    ctx.fillText(`MODE: ${target ? 'TRACK [AUTO]' : 'SEARCH [AUTO]'}`, margin + 6, margin + 20);
    ctx.fillText(`ZOOM: ${zoomVal}`, margin + 6, margin + 32);
    ctx.fillText(`AGC:  AUTO`, margin + 6, margin + 44);

    // Top-Right corner HUD values
    ctx.textAlign = 'right';
    ctx.fillText(`FOV:   WFOV`, this.w - margin - 6, margin + 20);
    ctx.fillText(`SYS:   OK`, this.w - margin - 6, margin + 32);
    ctx.fillText(`NUC:   OK`, this.w - margin - 6, margin + 44);

    // Bottom status line
    ctx.textAlign = 'center';
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillText(`PTZ STABILIZED // ANTIGRAVITY ENGINE v2.0`, cx, this.h - 8);
    ctx.restore();
  }

  _drawNoSignal(ctx) {
    ctx.font = '600 14px "Inter", sans-serif';
    ctx.fillStyle = 'hsla(0, 0%, 60%, 0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('NO SIGNAL', this.w / 2, this.h / 2);
  }

  _updateInfo(target) {
    const az = ((target.theta * 180) / Math.PI).toFixed(1);
    const el = (target.altitude / 30).toFixed(1);

    this.cameraInfo.innerHTML = `
      <div>Lat: <span style="color:var(--text-primary)">${(22 + Math.random() * 0.01).toFixed(4)}°</span></div>
      <div>Lon: <span style="color:var(--text-primary)">${(88 + Math.random() * 0.01).toFixed(4)}°</span></div>
      <div>Fov: <span style="color:var(--text-primary)">${(33 + Math.random() * 0.1).toFixed(1)}°</span></div>
    `;
  }

  _getLockedTarget() {
    if (this.selectedTargetId) {
      return this.targets.find((t) => t.id === this.selectedTargetId);
    }
    // Auto-lock on highest threat
    return this.targets[0] || null;
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.el.remove();
  }
}
