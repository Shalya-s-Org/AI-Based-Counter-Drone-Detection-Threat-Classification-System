import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (!window.ResizeObserver) {
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      window.ResizeObserver = ResizeObserver;
    }

    if (!window.AudioContext && !window.webkitAudioContext) {
      window.AudioContext = class MockAudioContext {
        createGain() {
          return {
            gain: { value: 0 },
            connect: () => {},
          };
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: { value: 0 },
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        createBuffer() {
          return { getChannelData: () => new Float32Array(0) };
        }
        createBufferSource() {
          return {
            buffer: null,
            connect: () => {},
            start: () => {},
          };
        }
        decodeAudioData() {
          return Promise.resolve({});
        }
        close() {
          return Promise.resolve();
        }
        get currentTime() {
          return 0;
        }
        get sampleRate() {
          return 44100;
        }
        get destination() {
          return { connect: () => {} };
        }
        resume() {
          return Promise.resolve();
        }
        suspend() {
          return Promise.resolve();
        }
      };
    }

    const mockCtx = () => ({
      setTransform: () => {},
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {},
      createConicGradient: () => ({
        addColorStop: () => {},
      }),
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      drawImage: () => {},
      setLineDash: () => {},
      getContext: () => ({}),
    });

    if (typeof HTMLCanvasElement !== 'undefined') {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type) {
        if (type === '2d') {
          return mockCtx();
        }
        if (originalGetContext) {
          return originalGetContext.call(this, type);
        }
        return null;
      };
    }
  }
});

afterAll(() => {
  // cleanup if needed
});
