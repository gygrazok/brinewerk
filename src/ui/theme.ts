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
      --danger-bg:  #1c1418;
      --danger-border: #5a2a3a;
      --danger-text: #e07070;

      /* Fonts */
      --font-display: 'Press Start 2P', monospace;
      --font-body: 'Chakra Petch', monospace;
      --font: var(--font-display); /* backwards compat */

      /* Zone heights */
      --top-bar-h: 44px;
      --bottom-bar-h: 48px;
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
      font-family: var(--font-body);
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
      font-family: var(--font-body);
      color: var(--text);
      z-index: 10;
      pointer-events: auto;
      overflow-x: auto;
    }

    /* ── Top bar: resources ──────────────────── */

    .resource-list {
      display: flex;
      align-items: center;
      gap: 14px;
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
      font-family: var(--font-body);
      font-size: 16px;
      font-weight: 500;
      color: var(--accent-hi);
      white-space: nowrap;
    }
    .resource-item .res-rate {
      font-family: var(--font-body);
      font-size: 13px;
      color: var(--accent);
    }

    .top-sep {
      width: 1px;
      height: 24px;
      background: var(--border);
      flex-shrink: 0;
    }

    /* ── Shared button styles ────────────────── */

    .btn {
      font-family: var(--font-body);
      border-radius: 4px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s, opacity 0.15s;
      text-align: center;
      line-height: 1.4;
    }

    /* Primary: accent-bordered, bright text */
    .btn-primary {
      background: var(--bg-slot);
      border: 1px solid var(--accent);
      color: var(--accent-hi);
      font-size: 15px;
      font-weight: 500;
      padding: 10px 16px;
    }
    .btn-primary:hover:not(.disabled) {
      background: var(--accent);
      color: var(--bg-deep);
    }

    /* Secondary: subtle border, normal text */
    .btn-secondary {
      background: var(--bg-deep);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
      padding: 8px 12px;
    }
    .btn-secondary:hover:not(.disabled):not(.unaffordable) {
      border-color: var(--accent);
      color: var(--accent-hi);
    }

    /* Danger: warm tones for destructive actions */
    .btn-danger {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger-text);
      font-size: 15px;
      font-weight: 500;
      padding: 10px 16px;
    }
    .btn-danger:hover:not(.disabled) {
      background: #2a1a22;
      border-color: var(--danger-text);
    }

    /* Ghost: borderless, dim text */
    .btn-ghost {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 16px;
      padding: 4px 8px;
    }
    .btn-ghost:hover { color: var(--accent-hi); }

    /* Rare variant: magenta tones (combine with btn-secondary) */
    .btn-rare { border-color: #8b225260; }
    .btn-rare:hover:not(.unaffordable):not(.disabled) { border-color: #c44488; color: #e066aa; }

    /* Small size modifier */
    .btn-sm { font-size: 13px; padding: 5px 14px; }

    /* Inline cost label inside buttons */
    .btn-cost { font-size: 12px; color: var(--text-dim); }

    /* Pulse animation for attention states */
    .btn-pulse {
      border-color: var(--accent);
      color: var(--accent-hi);
      animation: btn-pulse-anim 2s ease-in-out infinite;
    }
    @keyframes btn-pulse-anim {
      0%, 100% { box-shadow: 0 0 0 0 rgba(58, 173, 168, 0); }
      50% { box-shadow: 0 0 8px 2px rgba(58, 173, 168, 0.3); }
    }

    /* Disabled state (any button variant) */
    .btn.disabled, .btn.unaffordable {
      opacity: 0.35;
      pointer-events: none;
    }
    .btn.disabled {
      border-color: var(--border);
      color: var(--text-dim);
    }

    /* ── Mobile adjustments ──────────────────── */

    @media (max-width: 640px) {
      :root {
        --top-bar-h: 40px;
        --bottom-bar-h: 44px;
      }
      .resource-item .res-value { font-size: 14px; }
      .resource-item .res-rate { font-size: 11px; }
      .btn-primary { font-size: 13px; padding: 8px 12px; }
      .btn-secondary { font-size: 13px; padding: 6px 10px; }
      .btn-danger { font-size: 13px; padding: 8px 12px; }
      .btn-sm { font-size: 12px; padding: 4px 12px; }
      .btn-cost { font-size: 11px; }
    }
  `;

  document.head.appendChild(style);
}
