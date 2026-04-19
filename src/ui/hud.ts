import type { GameState } from '../core/game-state';
import { getProductionRates } from '../economy/production-engine';
import { getUpgradeLevel } from '../systems/upgrades';

/** Resource definitions — easy to extend with new resources */
interface ResourceDef {
  key: keyof GameState['resources'];
  icon: string;
  showRate?: boolean;
  /** Function returning true when this resource's slot should be rendered. */
  visible?: (state: GameState) => boolean;
}

const RESOURCES: ResourceDef[] = [
  { key: 'plankton', icon: '🟢', showRate: true },
  { key: 'minerite', icon: '🔵', showRate: true, visible: (s) => getUpgradeLevel(s, 'deep_drilling') > 0 },
  { key: 'lux',      icon: '✨', showRate: true, visible: (s) => getUpgradeLevel(s, 'bioluminescence') > 0 },
  { key: 'nacre',    icon: '⚬', visible: (s) => s.releaseUnlocked },
  { key: 'coral',    icon: '🪸', visible: (s) => s.resources.coral > 0 },
];

interface ResourceRow {
  item: HTMLDivElement;
  sep: HTMLDivElement | null;
  value: HTMLSpanElement;
  rate: HTMLSpanElement | null;
}

let rows: Map<ResourceDef['key'], ResourceRow> | null = null;

function mount(bar: HTMLElement): Map<ResourceDef['key'], ResourceRow> {
  bar.textContent = '';
  const list = document.createElement('div');
  list.className = 'resource-list';
  list.id = 'resource-list';
  bar.appendChild(list);

  const map = new Map<ResourceDef['key'], ResourceRow>();
  RESOURCES.forEach((r, i) => {
    const sep = i > 0 ? document.createElement('div') : null;
    if (sep) {
      sep.className = 'top-sep';
      list.appendChild(sep);
    }

    const item = document.createElement('div');
    item.className = 'resource-item';

    const value = document.createElement('span');
    value.className = 'res-value';
    item.appendChild(value);

    let rate: HTMLSpanElement | null = null;
    if (r.showRate) {
      rate = document.createElement('span');
      rate.className = 'res-rate';
      item.appendChild(rate);
    }

    list.appendChild(item);
    map.set(r.key, { item, sep, value, rate });
  });
  return map;
}

export function updateHud(state: GameState): void {
  const bar = document.getElementById('top-bar');
  if (!bar) return;

  if (!rows) rows = mount(bar);

  const rates = getProductionRates(state);
  for (const r of RESOURCES) {
    const row = rows.get(r.key)!;
    const visible = r.visible ? r.visible(state) : true;
    const display = visible ? '' : 'none';
    row.item.style.display = display;
    if (row.sep) row.sep.style.display = display;
    if (!visible) continue;

    const val = Math.floor(state.resources[r.key]);
    row.value.textContent = `${val} ${r.icon}`;

    if (row.rate) {
      const rate = r.key === 'plankton' ? rates.plankton
                 : r.key === 'minerite' ? rates.minerite
                 : r.key === 'lux'      ? rates.lux
                 : 0;
      row.rate.textContent = `+${rate.toFixed(2)}/s`;
    }
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    rows = null;
  });
}
