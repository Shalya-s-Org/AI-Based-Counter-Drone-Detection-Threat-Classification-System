/**
 * AeroGuard AI — Audio Alert System
 * Web Audio API for threat-level chimes and alarms.
 */

let audioContext = null;
let audioEnabled = true;

/**
 * Get or create the AudioContext (lazy init on user gesture).
 */
function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Play a tone at given frequency and duration.
 */
function playTone(frequency, duration = 0.2, type = 'sine', volume = 0.15) {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail — audio is non-critical
  }
}

/**
 * Play alert sound based on threat level.
 * @param {'FALSE_POSITIVE' | 'LOW' | 'WARNING' | 'CRITICAL'} level
 */
export function playAlertSound(level) {
  if (!audioEnabled) return;

  switch (level) {
    case 'CRITICAL':
      // Urgent two-tone alarm
      playTone(880, 0.15, 'square', 0.12);
      setTimeout(() => playTone(1100, 0.15, 'square', 0.12), 180);
      setTimeout(() => playTone(880, 0.15, 'square', 0.12), 360);
      break;

    case 'WARNING':
      // Medium alert beep
      playTone(660, 0.2, 'triangle', 0.1);
      setTimeout(() => playTone(660, 0.2, 'triangle', 0.1), 250);
      break;

    case 'LOW':
      // Soft notification
      playTone(440, 0.15, 'sine', 0.06);
      break;

    case 'FALSE_POSITIVE':
      // Quiet blip
      playTone(330, 0.1, 'sine', 0.03);
      break;
  }
}

/**
 * Play countermeasure activation sound.
 */
export function playCountermeasureSound() {
  if (!audioEnabled) return;
  playTone(200, 0.1, 'sawtooth', 0.08);
  setTimeout(() => playTone(400, 0.15, 'sawtooth', 0.08), 120);
  setTimeout(() => playTone(800, 0.2, 'sawtooth', 0.06), 260);
}

/**
 * Play a UI click/select sound.
 */
export function playSelectSound() {
  if (!audioEnabled) return;
  playTone(600, 0.06, 'sine', 0.04);
}

/**
 * Toggle audio alerts on/off.
 * @param {boolean} enabled
 */
export function toggleAudioAlerts(enabled) {
  audioEnabled = enabled;
}

/**
 * Get current audio state.
 * @returns {boolean}
 */
export function isAudioEnabled() {
  return audioEnabled;
}
