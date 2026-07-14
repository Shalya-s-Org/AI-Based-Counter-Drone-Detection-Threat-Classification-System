# AeroGuard AI — Counter-UAS Operations Dashboard

**AI-Based Counter-Drone Detection & Threat Classification System**

A premium browser-based Counter-UAS Operations Dashboard combining a 360° radar visualizer, AI-powered threat classifier, multi-channel camera feeds, countermeasure controls, and persistent event logging — all running client-side with zero backend dependencies.

![Status](https://img.shields.io/badge/status-production--ready-green)
![Vite](https://img.shields.io/badge/Vite-8.1.4-646CFF?logo=vite)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

### 360° Airspace Radar
- Canvas-based polar sweep with dynamic target blips
- Hover telemetry tooltips with threat data
- 60 FPS animation with off-screen canvas optimization
- Click-to-select target synchronization

### AI Threat Classifier
- Multi-factor weighted scoring (Speed, Altitude, RCS, Behavior)
- 4-tier classification: False Positive → Low → Warning → Critical
- Real-time reclassification on state changes

### Multi-Channel Camera Feed
- Simulated PTZ viewport with Optical / Thermal / IR channels
- Dynamic bounding boxes with threat-level color coding
- Classification labels with confidence scores
- HUD overlay with azimuth, elevation, zoom

### Active Target Registry
- Threat-sorted grid (Critical → Warning → Low → False Positive)
- Per-target detail display with live stats
- Filter controls by threat level
- Cross-component selection sync

### Countermeasure Controls
- RF Jammer, GPS Spoofer, Kinetic Intercept, Air-Raid Alarm
- Cockpit-style 2x2 engagement panel with tactical variants
- Cooldown timer progress bars
- Audio alert toggle with Web Audio API

### Persistent Alert Log
- Scrollable event stream with timestamps and icons
- Filter by level, full-text search
- CSV export for incident reporting
- Session recovery on page load

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Build** | Vite 5.x |
| **Language** | Vanilla JavaScript (ES6+) |
| **Markup** | HTML5 Semantic |
| **Styling** | CSS3 (HSL Variables, Grid, Flexbox) |
| **Rendering** | Canvas 2D API |
| **Icons** | Lucide Icons |
| **Audio** | Web Audio API |
| **Storage** | LocalStorage |
| **Testing** | Vitest + jsdom |

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Opens at http://localhost:3000

# Run tests
npx vitest run

# Production build
npm run build
```

### Project Structure

```
├── index.html                  # Entry point
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration with path aliases
├── vitest.config.js            # Test configuration
│
├── src/
│   ├── main.js                 # Application bootstrap
│   ├── App.js                  # Dashboard assembly & layout
│   │
│   ├── engine/                 # Simulation Engine Layer
│   │   ├── SimulationEngine.js
│   │   ├── TargetManager.js
│   │   ├── ThreatClassifier.js
│   │   ├── CountermeasureEngine.js
│   │   └── EventEmitter.js
│   │
│   ├── components/             # Presentation Layer
│   │   ├── Radar.js
│   │   ├── CameraFeed.js
│   │   ├── TargetList.js
│   │   ├── Controls.js
│   │   ├── AlertLog.js
│   │   └── HeaderBar.js
│   │
│   ├── utils/                  # Shared utilities
│   │   ├── math.js
│   │   ├── constants.js
│   │   ├── storage.js
│   │   └── audio.js
│   │
│   └── styles/                 # CSS Design System
│       ├── index.css
│       ├── layout.css
│       ├── components.css
│       └── glassmorphism.css
│
├── tests/
│   └── engine/                 # Unit tests
│       ├── EventEmitter.test.js
│       ├── TargetManager.test.js
│       ├── ThreatClassifier.test.js
│       ├── CountermeasureEngine.test.js
│       └── SimulationEngine.test.js
│
└── memory-bank/                # Project documentation
    ├── progress.md
    ├── architecture.md
    ├── implementation_plan.md
    ├── technical_workflows.md
    └── AI-Based Counter-Drone Detection & Threat Classification System.md
```

---

## Architecture

### Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│     Presentation Layer (UI Components)  │
│  Radar | Camera | TargetList | Controls │
└─────────────────────────────────────────┘
              ↓ ↑ Event Bus (pub/sub)
┌─────────────────────────────────────────┐
│     Simulation Engine Layer             │
│  TargetManager | ThreatClassifier | CM  │
└─────────────────────────────────────────┘
              ↓ ↑ Event Bus (pub/sub)
┌─────────────────────────────────────────┐
│     Persistence Layer                   │
│     LocalStorage (Event Logs)           │
└─────────────────────────────────────────┘
```

### Data Flow

1. **SimulationEngine** runs the game loop via `requestAnimationFrame`
2. **TargetManager** updates target positions each tick
3. **ThreatClassifier** re-evaluates threat scores
4. **CountermeasureEngine** processes active effects
5. **EventEmitter** broadcasts state changes
6. **UI Components** render updates efficiently

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Pause / Resume simulation |
| `1` | Activate RF Jammer |
| `2` | Activate GPS Spoofer |
| `3` | Activate Kinetic Intercept |
| `4` | Activate Air-Raid Alarm |
| `Esc` | Deselect target |

---

## Threat Classification

| Score Range | Level | Label | Color |
|-------------|-------|-------|-------|
| TS < 25 | FALSE_POSITIVE | Bird / Weather Balloon | Green |
| 25 ≤ TS < 60 | LOW | Commercial Quadcopter (Light) | Blue |
| 60 ≤ TS < 85 | WARNING | Commercial Drone (Heavy Payload) | Amber |
| TS ≥ 85 | CRITICAL | Weaponized / Military UAV | Red |

---

## Testing

```bash
# Run all tests
npx vitest run

# Run with coverage
npx vitest run --coverage

# Watch mode
npx vitest
```

### Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| EventEmitter | 9 | ✅ Passing |
| TargetManager | 9 | ✅ Passing |
| ThreatClassifier | 8 | ✅ Passing |
| CountermeasureEngine | 12 | ✅ Passing |
| SimulationEngine | 8 | ✅ Passing |

---

## Deployment

### Build for Production

```bash
npm run build
```

Outputs to `dist/` directory.

### Deploy to GitHub Pages

1. Update `vite.config.js` base path if needed
2. Build the project
3. Push `dist/` to `gh-pages` branch

### Deploy to Vercel / Netlify

Connect your repository and deploy automatically on push.

---

## Team

**AeroGuard AI** — Centre for Defence Technology & Innovation

- Lead Engineer — System Architecture, Radar Simulation & Canvas Rendering
- AI Specialist — Threat Classification Algorithms, Computer Vision & Scoring Models
- Frontend Developer — Dashboard UI/UX, Real-time Components & Glassmorphism Design
- DevOps Engineer — Testing Strategy, CI/CD Pipeline & Deployment Automation

---

## License

MIT

---

## Acknowledgments

- Built for **TCOE India Emerging Technologies Hackathon 2026**
- Inspired by NATO STANAG 4778 C-UAS interoperability protocols
- Designed for training simulation and future live sensor integration
