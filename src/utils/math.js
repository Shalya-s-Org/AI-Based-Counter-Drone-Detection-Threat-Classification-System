/**
 * AeroGuard AI — Math Utilities
 * Coordinate conversion, normalization, interpolation, and noise functions.
 */

/**
 * Convert polar coordinates to cartesian.
 * @param {number} r - Radial distance
 * @param {number} theta - Angle in radians
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @returns {{ x: number, y: number }}
 */
export function polarToCartesian(r, theta, cx = 0, cy = 0) {
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
}

/**
 * Convert cartesian coordinates to polar.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @returns {{ r: number, theta: number }}
 */
export function cartesianToPolar(x, y, cx = 0, cy = 0) {
  const dx = x - cx;
  const dy = y - cy;
  return {
    r: Math.sqrt(dx * dx + dy * dy),
    theta: Math.atan2(dy, dx),
  };
}

/**
 * Normalize a value to [0, 1] range.
 */
export function normalize(value, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Gaussian random number using Box-Muller transform.
 */
export function gaussianRandom(mean = 0, stddev = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return z * stddev + mean;
}

/**
 * Euclidean distance between two points.
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Degrees to radians.
 */
export function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Radians to degrees.
 */
export function radiansToDegrees(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Random float in range [min, max).
 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in range [min, max] inclusive.
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Format angle for display (e.g., "045°").
 */
export function formatBearing(radians) {
  let deg = radiansToDegrees(radians) % 360;
  if (deg < 0) deg += 360;
  return `${Math.round(deg)}°`;
}

/**
 * Format distance for display.
 */
export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Smooth step interpolation.
 */
export function smoothStep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Map a value from one range to another.
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
