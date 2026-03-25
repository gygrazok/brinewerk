import type { AchievementDefinition } from '../systems/achievements';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'achievement-toast-styles';
  style.textContent = `
    .achievement-toast {
      position: fixed;
      top: 60px; left: 50%;
      transform: translateX(-50%) translateY(-20px);
      z-index: 300;
      background: var(--bg-panel);
      border: 1px solid var(--accent);
      border-radius: 8px;
      padding: 12px 20px;
      display: flex; align-items: center; gap: 12px;
      font-family: var(--font-body);
      color: var(--text);
      box-shadow: 0 0 16px rgba(58, 173, 168, 0.3);
      opacity: 0;
      transition: opacity 0.4s ease, transform 0.4s ease;
      pointer-events: none;
    }
    .achievement-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .achievement-toast-icon { font-size: 28px; }
    .achievement-toast-info { display: flex; flex-direction: column; gap: 2px; }
    .achievement-toast-title {
      font-family: var(--font-display);
      font-size: 10px;
      color: var(--accent-hi);
    }
    .achievement-toast-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--name);
    }
    .achievement-toast-reward {
      font-size: 12px;
      color: var(--accent);
    }
  `;
  document.head.appendChild(style);
}

export function showAchievementToast(def: AchievementDefinition): void {
  injectStyles();

  const el = document.createElement('div');
  el.className = 'achievement-toast';
  el.innerHTML = `
    <span class="achievement-toast-icon">${def.icon}</span>
    <div class="achievement-toast-info">
      <span class="achievement-toast-title">ACHIEVEMENT UNLOCKED</span>
      <span class="achievement-toast-name">${def.name}</span>
      <span class="achievement-toast-reward">${def.reward.label}</span>
    </div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 4000);
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const styles = document.getElementById('achievement-toast-styles');
    if (styles) styles.remove();
    stylesInjected = false;
    document.querySelectorAll('.achievement-toast').forEach(el => el.remove());
  });
}
