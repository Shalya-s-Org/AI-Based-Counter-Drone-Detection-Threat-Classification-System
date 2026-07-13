/**
 * @fileoverview AeroGuard AI — Project Constants
 * Centralised configuration for threat classification, countermeasures,
 * radar parameters, simulation tuning, event bus topics, and target states.
 * @module utils/constants
 */

/* ───────────────────────────── Threat Levels ───────────────────────────── */

/**
 * Threat‑level definitions mapped to score bands, display colours, and CSS hooks.
 * @readonly
 * @enum {Object}
 */
export const THREAT_LEVELS = {
  FALSE_POSITIVE: {
    key: 'FALSE_POSITIVE',
    min: 0,
    max: 24,
    label: 'False Positive',
    color: 'hsl(120, 60%, 50%)',
    glow: 'hsla(120, 60%, 50%, 0.3)',
    cssClass: 'threat-false-positive',
  },
  LOW: {
    key: 'LOW',
    min: 25,
    max: 59,
    label: 'Low Threat',
    color: 'hsl(200, 70%, 55%)',
    glow: 'hsla(200, 70%, 55%, 0.3)',
    cssClass: 'threat-low',
  },
  WARNING: {
    key: 'WARNING',
    min: 60,
    max: 84,
    label: 'Warning',
    color: 'hsl(45, 90%, 55%)',
    glow: 'hsla(45, 90%, 55%, 0.3)',
    cssClass: 'threat-warning',
  },
  CRITICAL: {
    key: 'CRITICAL',
    min: 85,
    max: 100,
    label: 'Critical',
    color: 'hsl(0, 80%, 55%)',
    glow: 'hsla(0, 80%, 55%, 0.3)',
    cssClass: 'threat-critical',
  },
};

/* ────────────────────────────── Target Labels ─────────────────────────── */

/**
 * Human‑readable labels for each threat classification tier.
 * @readonly
 * @enum {string}
 */
export const TARGET_LABELS = {
  FALSE_POSITIVE: 'Bird / Weather Balloon',
  LOW: 'Commercial Quadcopter (Light)',
  WARNING: 'Commercial Drone (Heavy Payload)',
  CRITICAL: 'Weaponized / Military UAV',
};

/* ──────────────────────────── Scoring Weights ─────────────────────────── */

/**
 * Percentage weights for the composite threat score.
 * Must sum to 100.
 * @readonly
 * @type {{ speed: number, altitude: number, rcs: number, behavior: number }}
 */
export const SCORING_WEIGHTS = {
  speed: 25,
  altitude: 20,
  rcs: 25,
  behavior: 30,
};

/* ─────────────────────────── Countermeasures ──────────────────────────── */

/**
 * Available countermeasure systems.
 * `duration` is the active‑engagement time in ms (`null` = instantaneous).
 * `cooldown` is the recovery period in ms before the system can fire again.
 * @readonly
 * @enum {Object}
 */
export const COUNTERMEASURE_TYPES = {
  RF_JAM: {
    key: 'RF_JAM',
    label: 'RF Jammer',
    icon: 'wifi-off',
    duration: 10_000,
    cooldown: 15_000,
  },
  GPS_SPOOF: {
    key: 'GPS_SPOOF',
    label: 'GPS Spoofing',
    icon: 'navigation-off',
    duration: 15_000,
    cooldown: 20_000,
  },
  KINETIC: {
    key: 'KINETIC',
    label: 'Kinetic Intercept',
    icon: 'crosshair',
    duration: null,
    cooldown: 30_000,
  },
  ALARM: {
    key: 'ALARM',
    label: 'Air-Raid Alarm',
    icon: 'volume-2',
    duration: null,
    cooldown: 0,
  },
};

/* ────────────────────────────── Radar Config ──────────────────────────── */

/**
 * Radar display parameters.
 * @readonly
 * @type {{ maxRange: number, sweepRPM: number, rings: number }}
 */
export const RADAR_CONFIG = {
  maxRange: 1000,
  sweepRPM: 6,
  rings: 4,
};

/* ─────────────────────────── Simulation Config ────────────────────────── */

/**
 * Simulation tuning knobs controlling target spawning and attribute ranges.
 * @readonly
 * @type {Object}
 */
export const SIMULATION_CONFIG = {
  maxTargets: 15,
  spawnIntervalMs: 3000,
  minSpeed: 2,
  maxSpeed: 35,
  minAltitude: 10,
  maxAltitude: 500,
  minRCS: 0.01,
  maxRCS: 2.0,
};

/* ──────────────────────────── Event Bus Topics ────────────────────────── */

/**
 * Canonical event names used across the application event bus.
 * @readonly
 * @enum {string}
 */
export const EVENT_TYPES = {
  TARGET_SPAWN: 'target:spawn',
  TARGET_UPDATE: 'target:update',
  TARGET_DESTROY: 'target:destroy',
  THREAT_RECLASSIFY: 'threat:reclassify',
  TARGET_SELECT: 'target:select',
  COUNTERMEASURE_ACTIVATE: 'countermeasure:activate',
  COUNTERMEASURE_STATUS: 'countermeasure:status',
  COUNTERMEASURE_COMPLETE: 'countermeasure:complete',
  ALERT_LOG: 'alert:log',
  ENGINE_STATUS: 'engine:status',
  CAMERA_LOCK: 'camera:lock',
  CAMERA_CHANNEL: 'camera:channelSwitch',
};

/* ─────────────────────────── Target Statuses ─────────────────────────── */

/**
 * Lifecycle states a tracked target can occupy.
 * @readonly
 * @enum {string}
 */
export const TARGET_STATUSES = {
  ACTIVE: 'ACTIVE',
  JAMMED: 'JAMMED',
  SPOOFED: 'SPOOFED',
  INTERCEPTED: 'INTERCEPTED',
  DESTROYED: 'DESTROYED',
};
