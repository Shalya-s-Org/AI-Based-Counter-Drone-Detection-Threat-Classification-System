/**
 * @fileoverview AeroGuard AI — Audio Manager
 * Procedurally generates alert tones, countermeasure confirmations, and
 * notification blips using the Web Audio API.  No external audio files
 * are required.
 *
 * The `AudioContext` is lazily created on the first user gesture to comply
 * with browser autoplay policies.
 * @module utils/audio
 */

/**
 * Manages all procedural audio for the AeroGuard UI.
 */
class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;

    /** @type {boolean} */
    this._muted = false;

    /** @type {GainNode|null} Master gain node. */
    this._masterGain = null;
  }

  /* ────────────────────── Lifecycle ────────────────────── */

  /**
   * Lazily initialise the `AudioContext` and master gain.
   * Safe to call multiple times — subsequent calls are no‑ops.
   * Must be invoked inside a user‑gesture handler (click / keydown)
   * to satisfy browser autoplay restrictions.
   * @returns {AudioContext}
   */
  init() {
    if (this._ctx) return this._ctx;

    const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    this._ctx = new AudioCtx();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._muted ? 0 : 0.35;
    this._masterGain.connect(this._ctx.destination);

    return this._ctx;
  }

  /**
   * Ensure the context is running (resumes if suspended).
   * @private
   */
  _ensureRunning() {
    if (!this._ctx) this.init();
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  /* ────────────────────── Tone Helpers ─────────────────── */

  /**
   * Schedule a simple oscillator tone.
   * @private
   * @param {number}  frequency  — Hz.
   * @param {number}  duration   — Seconds.
   * @param {OscillatorType} [type='sine']
   * @param {number}  [startOffset=0] — Seconds from `now`.
   * @param {number}  [gain=0.5]
   */
  _playTone(frequency, duration, type = 'sine', startOffset = 0, gain = 0.5) {
    this._ensureRunning();
    const now = this._ctx.currentTime + startOffset;

    const osc = this._ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    const env = this._ctx.createGain();
    env.gain.setValueAtTime(0, now);
    // Quick attack → sustain → short release.
    env.gain.linearRampToValueAtTime(gain, now + 0.02);
    env.gain.setValueAtTime(gain, now + duration - 0.05);
    env.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(env);
    env.connect(this._masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  /* ────────────────── Public Sound Effects ─────────────── */

  /**
   * Play an alert tone whose urgency matches the threat level.
   *
   * | Level          | Sound                                |
   * |----------------|--------------------------------------|
   * | `CRITICAL`     | 880 Hz rapid triple‑beep (square)    |
   * | `WARNING`      | 660 Hz single sustained tone (sine)  |
   * | `LOW`          | 440 Hz short blip                    |
   * | default        | 330 Hz soft ping                     |
   *
   * @param {'CRITICAL'|'WARNING'|'LOW'|'FALSE_POSITIVE'} level
   */
  playAlert(level) {
    if (this._muted) return;

    switch (level) {
      case 'CRITICAL':
        // Rapid triple‑beep at 880 Hz.
        this._playTone(880, 0.10, 'square', 0.00, 0.6);
        this._playTone(880, 0.10, 'square', 0.15, 0.6);
        this._playTone(880, 0.10, 'square', 0.30, 0.6);
        break;

      case 'WARNING':
        // Single sustained tone at 660 Hz.
        this._playTone(660, 0.40, 'sine', 0, 0.45);
        break;

      case 'LOW':
        this._playTone(440, 0.18, 'sine', 0, 0.3);
        break;

      default:
        // FALSE_POSITIVE / unknown — very soft ping.
        this._playTone(330, 0.12, 'sine', 0, 0.15);
        break;
    }
  }

  /**
   * Play a short confirmation tone when a countermeasure is activated.
   * @param {'RF_JAM'|'GPS_SPOOF'|'KINETIC'|'ALARM'} type
   */
  playCountermeasure(type) {
    if (this._muted) return;

    switch (type) {
      case 'RF_JAM':
        // Low‑frequency buzz.
        this._playTone(220, 0.25, 'sawtooth', 0, 0.3);
        break;

      case 'GPS_SPOOF':
        // Descending sweep approximation.
        this._playTone(600, 0.12, 'triangle', 0.0, 0.3);
        this._playTone(450, 0.12, 'triangle', 0.12, 0.3);
        this._playTone(300, 0.12, 'triangle', 0.24, 0.3);
        break;

      case 'KINETIC':
        // Sharp attack.
        this._playTone(1000, 0.08, 'square', 0, 0.5);
        this._playTone(500, 0.15, 'sine', 0.08, 0.35);
        break;

      case 'ALARM':
        // Siren‑like alternating tones.
        for (let i = 0; i < 4; i++) {
          this._playTone(800, 0.12, 'square', i * 0.25, 0.4);
          this._playTone(600, 0.12, 'square', i * 0.25 + 0.12, 0.4);
        }
        break;

      default:
        this._playTone(520, 0.15, 'sine', 0, 0.25);
        break;
    }
  }

  /**
   * Play a subtle UI notification blip (e.g. new log entry).
   */
  playNotification() {
    if (this._muted) return;
    this._playTone(1200, 0.06, 'sine', 0, 0.15);
    this._playTone(1600, 0.06, 'sine', 0.07, 0.12);
  }

  /* ──────────────────── Mute Controls ──────────────────── */

  /**
   * Set the muted state.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this._muted = muted;
    if (this._masterGain) {
      this._masterGain.gain.setValueAtTime(muted ? 0 : 0.35, this._ctx.currentTime);
    }
  }

  /**
   * Toggle the muted state.
   * @returns {boolean} The new muted state.
   */
  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /**
   * Check current mute state.
   * @returns {boolean}
   */
  isMuted() {
    return this._muted;
  }
}

/**
 * Singleton instance shared across the application.
 * @type {AudioManager}
 */
const audioManager = new AudioManager();
export default audioManager;
export { AudioManager };
