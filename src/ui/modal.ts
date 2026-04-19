/**
 * Shared modal lifecycle helper.
 *
 * Handles the overlay + panel DOM, open/close animations, and listener
 * scoping via AbortController — so individual modal modules only define
 * content and content-specific CSS.
 *
 * Animation: desktop → centered scale + opacity fade; mobile → bottom sheet
 * slide-up. Matches the shore / upgrade / achievement modals' prior look.
 * Not suitable for side-sheet panels (creature-panel has its own layout).
 */

export interface ModalOptions {
  /**
   * Id prefix used for both overlay (`${id}-overlay`) and panel (`${id}-modal`).
   * Panel also receives the shared `modal-panel` class; overlay receives `modal-overlay`.
   */
  id: string;
  /**
   * Desktop width (CSS value — e.g. `'420px'` or `'min(90vw, 800px)'`).
   * Applied only in the `(min-width: 641px)` media query; mobile always uses full-width bottom sheet.
   */
  width?: string;
  /** Invoked each time the modal opens (and on `rerender()`). Receives the panel element and an abort signal scoped to the current open lifetime. */
  render: (panel: HTMLElement, signal: AbortSignal) => void;
  /** Invoked after the close animation finishes. */
  onClose?: () => void;
}

export interface ModalController {
  open(): void;
  close(): void;
  /** Clear panel content and re-invoke `render`. No-op if closed. */
  rerender(): void;
  readonly isOpen: boolean;
  /** Close if open, remove injected shared styles. */
  destroy(): void;
}

const SHARED_STYLES_ID = 'modal-shared-styles';

function injectSharedStyles(): void {
  if (document.getElementById(SHARED_STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = SHARED_STYLES_ID;
  style.textContent = `
    .modal-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(4, 10, 14, 0.7);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .modal-overlay.open { opacity: 1; pointer-events: auto; }

    .modal-panel {
      position: fixed; z-index: 101;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      font-family: var(--font-body);
      color: var(--text);
      display: flex; flex-direction: column;
      overflow-y: auto;
    }
    @media (min-width: 641px) {
      .modal-panel {
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        opacity: 0;
        width: var(--modal-width, 420px);
        max-height: 85vh;
        border-radius: 10px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      }
      .modal-panel.open { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @media (max-width: 640px) {
      .modal-panel {
        left: 0; right: 0; bottom: 0;
        max-height: 85vh;
        border-radius: 12px 12px 0 0;
        border-bottom: none;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .modal-panel.open { transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

export function createModal(opts: ModalOptions): ModalController {
  let overlay: HTMLDivElement | null = null;
  let panel: HTMLDivElement | null = null;
  let abort: AbortController | null = null;
  let isOpen = false;

  function open(): void {
    if (isOpen) return;
    isOpen = true;

    abort = new AbortController();
    const { signal } = abort;

    injectSharedStyles();

    overlay = document.createElement('div');
    overlay.id = `${opts.id}-overlay`;
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', () => close(), { signal });
    document.body.appendChild(overlay);

    panel = document.createElement('div');
    panel.id = `${opts.id}-modal`;
    panel.className = 'modal-panel';
    if (opts.width) panel.style.setProperty('--modal-width', opts.width);
    panel.addEventListener('click', (e) => e.stopPropagation(), { signal });
    document.body.appendChild(panel);

    opts.render(panel, signal);

    requestAnimationFrame(() => {
      overlay?.classList.add('open');
      panel?.classList.add('open');
    });
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    abort?.abort();
    abort = null;

    const o = overlay;
    const p = panel;
    overlay = null;
    panel = null;

    if (o) {
      o.classList.remove('open');
      setTimeout(() => o.remove(), 250);
    }
    if (p) {
      p.classList.remove('open');
      setTimeout(() => p.remove(), 300);
    }

    opts.onClose?.();
  }

  function rerender(): void {
    if (!isOpen || !panel || !abort) return;
    panel.textContent = '';
    opts.render(panel, abort.signal);
  }

  function destroy(): void {
    close();
    // Shared styles are app-scoped and left in place for other modals.
  }

  return {
    open,
    close,
    rerender,
    get isOpen() { return isOpen; },
    destroy,
  };
}

// HMR cleanup for the shared stylesheet
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.getElementById(SHARED_STYLES_ID)?.remove();
  });
}
