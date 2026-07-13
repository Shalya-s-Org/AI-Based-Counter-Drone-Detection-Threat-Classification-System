/**
 * @fileoverview AeroGuard AI — Math Utilities
 * Pure‑function helpers for coordinate transforms, interpolation, random
 * number generation, and unique‑ID minting.
 * @module utils/math
 */

/* ─────────────────── Coordinate Transforms ─────────────────── */

/**
 * Convert polar coordinates to Cartesian, optionally offset by a centre point.
 * @param {number} r     — Radius (distance from centre).
 * @param {number} theta — Angle in **radians** (0 = east, π/2 = south in screen space).
 * @param {number} [cx=0] — Centre‑x offset.
 * @param {number} [cy=0] — Centre‑y offset.
 * @returns {{ x: number, y: number }}
 */
export function polarToCartesian(r, theta, cx = 0, cy = 0) {
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
}

/**
 * Convert Cartesian coordinates to polar relative to a centre point.
 * @param {number} x  — X position.
 * @param {number} y  — Y position.
 * @param {number} [cx=0] — Centre‑x offset.
 * @param {number} [cy=0] — Centre‑y offset.
 * @returns {{ r: number, theta: number }} `theta` in radians.
 */
export function cartesianToPolar(x, y, cx = 0, cy = 0) {
  const dx = x - cx;
  const dy = y - cy;
  return {
    r: Math.sqrt(dx * dx + dy * dy),
    theta: Math.atan2(dy, dx),
  };
}

/* ────────────────────── Numeric Helpers ─────────────────────── */

/**
 * Clamp a value to the inclusive range [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linearly interpolate between `a` and `b` by factor `t ∈ [0, 1]`.
 * @param {number} a — Start value.
 * @param {number} b — End value.
 * @param {number} t — Interpolation factor.
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map `value` from the range [min, max] into [0, 1].
 * Returns 0 when `value ≤ min`, 1 when `value ≥ max`.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function normalize(value, min, max) {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/* ─────────────────────── Random / Noise ─────────────────────── */

/**
 * Generate a normally‑distributed random number via the Box–Muller transform.
 * @param {number} [mean=0]   — Distribution mean.
 * @param {number} [stddev=1] — Standard deviation.
 * @returns {number}
 */
export function gaussianRandom(mean = 0, stddev = 1) {
  let u = 0;
  let v = 0;
  // Reject exact‑zero to avoid log(0).
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stddev + mean;
}

/**
 * Generate a random float uniformly distributed in [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} array
 * @returns {T}
 */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/* ──────────────────── Geometry / Distance ───────────────────── */

/**
 * Euclidean distance between two 2‑D points.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle (radians) from point 1 → point 2.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} Angle in radians.
 */
export function angleBetween(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/* ──────────────── Degree / Radian Conversion ───────────────── */

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/* ───────────────────── ID Generation ───────────────────────── */

/** @type {Map<string, number>} Internal per‑prefix counters. */
const _idCounters = new Map();

/**
 * Generate a sequential, zero‑padded identifier.
 *
 * @example
 * generateId('TGT'); // → 'TGT-001'
 * generateId('TGT'); // → 'TGT-002'
 * generateId('CM');  // → 'CM-001'
 *
 * @param {string} [prefix='TGT'] — Prefix string.
 * @returns {string}
 */
export function generateId(prefix = 'TGT') {
  const current = (_idCounters.get(prefix) ?? 0) + 1;
  _idCounters.set(prefix, current);
  return `${prefix}-${String(current).padStart(3, '0')}`;
}
