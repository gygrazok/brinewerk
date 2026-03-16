/** Centralized UI theme — CSS custom properties + zone layout */

const THEME_ID = 'brinewerk-theme';

export function injectTheme(): void {
  if (document.getElementById(THEME_ID)) return;

  const style = document.createElement('style');
  style.id = THEME_ID;
  style.textContent = `
    :root {
      /* Colors */
      --bg-deep:    #060e12;
      --bg-panel:   #0a1a20;
      --bg-slot:    #0d2228;
      --border:     #1a3a3f;
      --text:       #b8d4d8;
      --text-dim:   #5a8a8f;
      --accent:     #3aada8;
      --accent-hi:  #7eeee4;
      --name:       #dadaff;
      --warn:       #8b3a5a;

      /* Font */
      --font: 'Press Start 2P', monospace;

      /* Zone heights */
      --top-bar-h: 44px;
      --bottom-bar-h: 100px;
    }

    /* ── Zone layout ─────────────────────────── */

    #top-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: var(--top-bar-h);
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0 12px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      font-family: var(--font);
      color: var(--text);
      z-index: 10;
      pointer-events: auto;
    }

    #game {
      position: absolute;
      top: var(--top-bar-h);
      left: 0; right: 0;
      bottom: var(--bottom-bar-h);
    }
    #game canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }

    #bottom-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: var(--bottom-bar-h);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 12px;
      background: var(--bg-panel);
      border-top: 1px solid var(--border);
      font-family: var(--font);
      color: var(--text);
      z-index: 10;
      pointer-events: auto;
      overflow-x: auto;
    }

    /* ── Top bar: resources ──────────────────── */

    .resource-list {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .resource-list::-webkit-scrollbar { display: none; }

    .resource-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      flex-shrink: 0;
    }
    .resource-item .res-value {
      font-size: 10px;
      color: var(--accent-hi);
      white-space: nowrap;
    }
    .resource-item .res-rate {
      font-size: 7px;
      color: var(--accent);
    }

    .tide-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      flex-shrink: 0;
    }
    .tide-status .tide-label {
      font-size: 7px;
      color: var(--text-dim);
      text-transform: uppercase;
    }
    .tide-status .tide-value {
      font-size: 8px;
      color: var(--accent);
    }

    .top-sep {
      width: 1px;
      height: 24px;
      background: var(--border);
      flex-shrink: 0;
    }

    /* ── Bottom bar: shore cards ─────────────── */

    .shore-empty {
      font-size: 8px;
      color: var(--accent);
      text-align: center;
    }

    .shore-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      transition: border-color 0.15s, opacity 0.15s;
      flex-shrink: 0;
    }
    .shore-card:hover:not(.unaffordable) {
      border-color: var(--accent);
    }
    .shore-card:hover.unaffordable {
      border-color: var(--warn);
    }
    .shore-card.unaffordable {
      opacity: 0.5;
    }

    .shore-card .shore-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    .shore-card .shore-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .shore-card .shore-name {
      font-size: 8px;
      color: var(--name);
    }
    .shore-card .shore-type {
      font-size: 7px;
      color: var(--accent);
    }
    .shore-card .shore-rare {
      font-size: 7px;
    }
    .shore-card .shore-cost {
      font-size: 8px;
      flex-shrink: 0;
    }

    /* ── Mobile adjustments ──────────────────── */

    @media (max-width: 640px) {
      :root {
        --top-bar-h: 40px;
        --bottom-bar-h: 80px;
      }

      .resource-item .res-value { font-size: 9px; }

      .shore-card {
        padding: 6px 10px;
        gap: 8px;
      }
      .shore-card .shore-icon { font-size: 14px; }
      .shore-card .shore-name { font-size: 7px; }
      .shore-card .shore-type { display: none; }
    }
  `;

  document.head.appendChild(style);
}
