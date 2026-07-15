/**
 * AeroGuard AI — Configuration Constants
 * Central source of truth for all system parameters.
 */

// ─── Threat Classification ────────────────────────────────────────
export const THREAT_LEVELS = {
  FALSE_POSITIVE: 'FALSE_POSITIVE',
  LOW: 'LOW',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
};

export const THREAT_THRESHOLDS = {
  FALSE_POSITIVE: 25,
  LOW: 60,
  WARNING: 85,
  // CRITICAL: >= 85
};

export const THREAT_COLORS = {
  FALSE_POSITIVE: 'hsl(120, 60%, 50%)',
  LOW: 'hsl(200, 70%, 55%)',
  WARNING: 'hsl(45, 90%, 55%)',
  CRITICAL: 'hsl(0, 80%, 55%)',
};

export const THREAT_COLORS_RGB = {
  FALSE_POSITIVE: { r: 51, g: 204, b: 51 },
  LOW: { r: 55, g: 160, b: 214 },
  WARNING: { r: 240, g: 195, b: 30 },
  CRITICAL: { r: 224, g: 55, b: 55 },
};

export const THREAT_LABELS = {
  FALSE_POSITIVE: 'Bird / Weather Balloon',
  LOW: 'Commercial Quadcopter (Light)',
  WARNING: 'Commercial Drone (Heavy Payload)',
  CRITICAL: 'Weaponized / Military UAV',
};

export const THREAT_WEIGHTS = {
  speed: 25,
  altitude: 20,
  rcs: 25,
  behavior: 30,
};

// ─── Countermeasure Definitions ───────────────────────────────────
export const COUNTERMEASURES = {
  RF_JAMMER: {
    id: 'RF_JAMMER',
    name: 'RF Jammer',
    icon: 'radio',
    armDelay: 500,
    duration: 10000,
    cooldown: 15000,
    color: 'hsl(0, 80%, 55%)',
  },
  GPS_SPOOFING: {
    id: 'GPS_SPOOFING',
    name: 'GPS Spoofing',
    icon: 'satellite',
    armDelay: 800,
    duration: 15000,
    cooldown: 20000,
    color: 'hsl(30, 90%, 55%)',
  },
  KINETIC_INTERCEPT: {
    id: 'KINETIC_INTERCEPT',
    name: 'Kinetic Intercept',
    icon: 'crosshair',
    armDelay: 1200,
    duration: 8000,
    cooldown: 30000,
    color: 'hsl(0, 90%, 50%)',
  },
  AIR_RAID_ALARM: {
    id: 'AIR_RAID_ALARM',
    name: 'Air-Raid Alarm',
    icon: 'siren',
    armDelay: 0,
    duration: 5000,
    cooldown: 10000,
    color: 'hsl(45, 90%, 55%)',
  },
  LASER_DAZZLER: {
    id: 'LASER_DAZZLER',
    name: 'Laser Dazzler',
    icon: 'zap',
    armDelay: 300,
    duration: 12000,
    cooldown: 25000,
    color: 'hsl(280, 80%, 60%)',
  },
  NET_CAPTURE: {
    id: 'NET_CAPTURE',
    name: 'Net Capture',
    icon: 'shield',
    armDelay: 1500,
    duration: 6000,
    cooldown: 20000,
    color: 'hsl(160, 70%, 50%)',
  },
};

// ─── Radar Configuration ──────────────────────────────────────────
export const RADAR_CONFIG = {
  maxRange: 1000,          // meters
  sweepSpeed: 0.02,        // radians per frame
  ringCount: 5,
  ringLabels: ['20', '40', '60', '80', '100'],
  blipFadeTime: 3000,      // ms
  sweepGlowWidth: 3,
  backgroundColor: 'hsl(220, 30%, 6%)',
  gridColor: 'hsla(190, 80%, 50%, 0.12)',
  sweepColor: 'hsla(190, 95%, 55%, 0.6)',
  blipMinRadius: 3,
  blipMaxRadius: 8,
};

// ─── Target Spawning ──────────────────────────────────────────────
export const TARGET_CONFIG = {
  minTargets: 3,
  maxTargets: 8,
  spawnInterval: 4000,     // ms between spawn attempts
  spawnProbability: 0.6,
  despawnRadius: 1.15,     // multiplier of maxRange
  idPrefix: 'TGT',
  speed: { min: 2, max: 25 },
  altitude: { min: 20, max: 500 },
  rcs: { min: 0.01, max: 2.0 },
  angularVelocity: { min: -0.05, max: 0.05 },
  behaviorPattern: { min: 0.0, max: 1.0 },
  brownianSigma: 0.3,
};

// ─── UAV Type Catalog ─────────────────────────────────────────────
export const UAV_TYPES = [
  { name: 'DJI Mavic', rcsRange: [0.01, 0.1], speedRange: [5, 15] },
  { name: 'DJI Phantom', rcsRange: [0.05, 0.2], speedRange: [8, 18] },
  { name: 'Parrot Anafi', rcsRange: [0.03, 0.12], speedRange: [6, 16] },
  { name: 'Skydio X2', rcsRange: [0.08, 0.25], speedRange: [10, 20] },
  { name: 'Military Fixed-Wing', rcsRange: [0.5, 2.0], speedRange: [15, 30] },
  { name: 'Racing Quad', rcsRange: [0.02, 0.08], speedRange: [20, 35] },
  { name: 'Heavy-Lift Hex', rcsRange: [0.3, 1.5], speedRange: [5, 12] },
  { name: 'Surveillance VTOL', rcsRange: [0.15, 0.6], speedRange: [8, 22] },
];

// ─── UI Configuration ─────────────────────────────────────────────
export const UI_CONFIG = {
  fps: 60,
  panelBorderRadius: '12px',
  panelBlur: '12px',
  animationDuration: '0.3s',
  maxLogEntries: 500,
  logFifoSize: 500,
};

// ─── Event Types ──────────────────────────────────────────────────
export const EVENTS = {
  TARGET_SPAWN: 'target:spawn',
  TARGET_UPDATE: 'target:update',
  TARGET_DESTROY: 'target:destroy',
  TARGET_SELECT: 'target:select',
  THREAT_RECLASSIFY: 'threat:reclassify',
  COUNTERMEASURE_ACTIVATE: 'countermeasure:activate',
  COUNTERMEASURE_STATUS: 'countermeasure:status',
  ALERT_LOG: 'alert:log',
  ENGINE_STATUS: 'engine:status',
  CAMERA_LOCK: 'camera:lock',
  CAMERA_CHANNEL_SWITCH: 'camera:channelSwitch',
  LOG_EXPORT: 'log:export',
};
