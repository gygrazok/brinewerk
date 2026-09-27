import { iconUrl, RESOURCE_ICON, type IconId } from '../rendering/pixel-icons';
import type { ResourceBundle } from '../core/game-state';

/** Inline pixel icon for HTML templates. `size` is the CSS size class (default 18 px, 'lg' = 27 px). */
export function icon(id: IconId, size: '' | 'lg' = ''): string {
  return `<img class="px-icon${size ? ` ${size}` : ''}" src="${iconUrl(id)}" alt="" draggable="false">`;
}

/** Resource icon shorthand: `res('plankton')`. */
export function res(key: keyof ResourceBundle): string {
  return icon(RESOURCE_ICON[key]);
}

/** Icon element for imperative DOM code (textContent-based widgets). */
export function iconEl(id: IconId): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'px-icon';
  img.src = iconUrl(id);
  img.alt = '';
  img.draggable = false;
  return img;
}
