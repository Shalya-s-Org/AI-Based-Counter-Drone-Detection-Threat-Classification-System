/**
 * AeroGuard AI — Application Entry Point
 * Bootstrap sequence: load styles → mount App → start simulation
 */

// ── Import Design System ──────────────────────────────────────
import './styles/index.css';
import './styles/layout.css';
import './styles/glassmorphism.css';
import './styles/components.css';

// ── Import App ────────────────────────────────────────────────
import { App } from './App.js';

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const rootEl = document.getElementById('app');

  if (!rootEl) {
    console.error('[AeroGuard] #app mount point not found');
    return;
  }

  // Create application instance
  const app = new App(rootEl);

  // Store globally for debugging
  window.__AEROGUARD__ = app;

  console.log(
    '%c⛨ AeroGuard AI — Tactical Command V2 %c Online',
    'background: hsl(220, 30%, 10%); color: hsl(190, 95%, 55%); padding: 4px 12px; font-weight: bold; border-radius: 4px 0 0 4px;',
    'background: hsl(120, 60%, 35%); color: white; padding: 4px 12px; font-weight: bold; border-radius: 0 4px 4px 0;'
  );
});
