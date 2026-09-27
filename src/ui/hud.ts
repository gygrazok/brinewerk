import type { GameState } from '../core/game-state';
import { getProductionRates } from '../economy/production-engine';
import { getUpgradeLevel } from '../systems/upgrades';
import { isReleaseUnlocked } from '../systems/achievements';
import { hasShallowSlot } from '../systems/coords';
import { formatNumber } from '../util/format';
import { iconEl } from './icons';
import { RESOURCE_ICON, materialIcon } from '../rendering/pixel-icons';
import { CreatureType, MATERIAL_NAMES, CREATURE_NAMES } from '../creatures/types';

/** Resource definitions — easy to extend with new resources */
interface ResourceDef {
  key: keyof GameState['resources'];
  showRate?: boolean;
  /** Function returning true when this resource's slot should be rendered. */
  visible?: (state: GameState) => boolean;
  /** Source → sinks, shown on hover. */
  tooltip: string;
}

const RESOURCES: ResourceDef[] = [
  { key: 'plankton', showRate: true,
    tooltip: 'Plankton · from all creatures + floating clumps · spent on feeding, upgrades, shore refresh' },
  { key: 'minerite', showRate: true, visible: (s) => getUpgradeLevel(s, 'deep_drilling') > 0,
    tooltip: 'Minerite · from creatures in deep slots · spent on upgrades' },
  { key: 'lux',      showRate: true, visible: (s) => hasShallowSlot(s.pool),
    tooltip: 'Lux · from creatures in shallow slots · spent on upgrades' },
  { key: 'nacre',    visible: (s) => isReleaseUnlocked(s),
    tooltip: 'Nacre · from releasing creatures · spent on slots and upgrades' },
  { key: 'coral',    visible: (s) => s.resources.coral > 0,
    tooltip: 'Coral · click seabed coral · spent on rare refresh' },
];

interface ResourceRow {
  item: HTMLDivElement;
  sep: HTMLDivElement | null;
  value: HTMLSpanElement;
  rate: HTMLSpanElement | null;
}

let rows: Map<ResourceDef['key'], ResourceRow> | null = null;
/** Species material counters, shown once the player owns any of that material. */
let materialRows: Map<CreatureType, { item: HTMLDivElement; value: HTMLSpanElement }> | null = null;

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
    item.title = r.tooltip;

    // Amount + icon on one line, rate below
    const top = document.createElement('div');
    top.className = 'res-top';
    const value = document.createElement('span');
    value.className = 'res-value';
    top.appendChild(value);
    top.appendChild(iconEl(RESOURCE_ICON[r.key]));
    item.appendChild(top);

    let rate: HTMLSpanElement | null = null;
    if (r.showRate) {
      rate = document.createElement('span');
      rate.className = 'res-rate';
      item.appendChild(rate);
    }

    list.appendChild(item);
    map.set(r.key, { item, sep, value, rate });
  });

  materialRows = new Map();
  const matGroup = document.createElement('div');
  matGroup.className = 'resource-item material-group';
  for (const t of Object.values(CreatureType)) {
    const item = document.createElement('div');
    item.className = 'material-item';
    item.title = `${MATERIAL_NAMES[t]} · from releasing ${CREATURE_NAMES[t]} · spent on ${CREATURE_NAMES[t]} growth stages`;
    const value = document.createElement('span');
    value.className = 'res-value';
    item.appendChild(value);
    item.appendChild(iconEl(materialIcon(t)));
    matGroup.appendChild(item);
    materialRows.set(t, { item, value });
  }
  list.appendChild(matGroup);
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

    row.value.textContent = formatNumber(state.resources[r.key]);

    if (row.rate) {
      const rate = r.key === 'plankton' ? rates.plankton
                 : r.key === 'minerite' ? rates.minerite
                 : r.key === 'lux'      ? rates.lux
                 : 0;
      row.rate.textContent = `+${formatNumber(rate, 2)}/s`;
    }
  }

  if (materialRows) {
    for (const [t, row] of materialRows) {
      const amount = state.materials[t];
      row.item.style.display = amount > 0 ? '' : 'none';
      if (amount > 0) row.value.textContent = formatNumber(amount);
    }
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    rows = null;
    materialRows = null;
  });
}
