// Древовидная раскладка графа сценария (Sugiyama-lite).
// Уровни — по длиннейшему пути; внутри уровня блок центрируется
// относительно барицентра родителей и детей за несколько проходов.
// Итог: линейная цепочка идёт строго вертикально, ветки — симметрично.

export type PosMap = Record<string, { x: number; y: number }>;

export interface LayoutOpts {
  nodeW?: number;
  hGap?: number;
  vGap?: number;
  startX?: number;
  startY?: number;
}

export function layoutFlow(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
  heightOf: (id: string) => number,
  opts: LayoutOpts = {}
): PosMap {
  const nodeW = opts.nodeW ?? 250;
  const hGap = opts.hGap ?? 80;
  const vGap = opts.vGap ?? 90;
  const startX = opts.startX ?? 160;
  const startY = opts.startY ?? 60;
  const step = nodeW + hGap;

  const ids = nodes.map((n) => n.id);
  if (!ids.length) return {};
  const idset = new Set(ids);

  const children: Record<string, string[]> = {};
  const parents: Record<string, string[]> = {};
  ids.forEach((id) => {
    children[id] = [];
    parents[id] = [];
  });
  for (const e of edges) {
    if (idset.has(e.from) && idset.has(e.to) && e.from !== e.to) {
      children[e.from].push(e.to);
      parents[e.to].push(e.from);
    }
  }

  // Уровни: длиннейший путь (для ацикличных графов), циклы ограничены итерациями.
  const level: Record<string, number> = {};
  ids.forEach((id) => (level[id] = 0));
  for (let it = 0; it < ids.length; it++) {
    let changed = false;
    for (const e of edges) {
      if (idset.has(e.from) && idset.has(e.to)) {
        if (level[e.to] < level[e.from] + 1) {
          level[e.to] = level[e.from] + 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Порядок внутри уровней — DFS от корней, чтобы поддеревья держались вместе.
  const order: Record<string, number> = {};
  let counter = 0;
  const visited = new Set<string>();
  const roots = ids.filter((id) => parents[id].length === 0);
  const starts = roots.length ? roots : ids;
  const dfs = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    order[id] = counter++;
    for (const c of children[id]) dfs(c);
  };
  starts.forEach(dfs);
  ids.forEach((id) => {
    if (!visited.has(id)) {
      visited.add(id);
      order[id] = counter++;
    }
  });

  const maxLv = Math.max(...ids.map((id) => level[id]));
  const byLevel: string[][] = [];
  for (let lv = 0; lv <= maxLv; lv++) byLevel[lv] = [];
  ids.forEach((id) => byLevel[level[id]].push(id));
  byLevel.forEach((arr) => arr.sort((a, b) => order[a] - order[b]));

  // Стартовые X по порядку в уровне.
  const x: Record<string, number> = {};
  byLevel.forEach((arr) => arr.forEach((id, i) => (x[id] = i * step)));

  const avg = (arr: string[]): number | null =>
    arr.length ? arr.reduce((s, id) => s + x[id], 0) / arr.length : null;

  // Расставляет уровень: тянет каждый блок к desired, держит порядок и зазор,
  // затем сдвигает весь ряд так, чтобы его центр совпал с барицентром desired.
  const resolveLevel = (arr: string[], desired: (id: string) => number | null) => {
    if (!arr.length) return;
    const d = arr.map((id) => {
      const v = desired(id);
      return v == null ? x[id] : v;
    });
    const pos = d.slice();
    for (let i = 1; i < pos.length; i++) {
      if (pos[i] < pos[i - 1] + step) pos[i] = pos[i - 1] + step;
    }
    const meanPos = pos.reduce((a, b) => a + b, 0) / pos.length;
    const meanDes = d.reduce((a, b) => a + b, 0) / d.length;
    const shift = meanDes - meanPos;
    arr.forEach((id, i) => (x[id] = pos[i] + shift));
  };

  for (let iter = 0; iter < 8; iter++) {
    for (let lv = 1; lv <= maxLv; lv++) resolveLevel(byLevel[lv], (id) => avg(parents[id]));
    for (let lv = maxLv - 1; lv >= 0; lv--) resolveLevel(byLevel[lv], (id) => avg(children[id]));
  }

  // Смещаем так, чтобы самый левый блок встал на startX.
  const minX = Math.min(...ids.map((id) => x[id]));
  const dx = startX - minX;

  // Y — по уровням, с учётом максимальной высоты ряда.
  const y: Record<string, number> = {};
  let cy = startY;
  for (let lv = 0; lv <= maxLv; lv++) {
    const arr = byLevel[lv];
    if (!arr.length) continue;
    arr.forEach((id) => (y[id] = cy));
    const maxH = Math.max(...arr.map((id) => heightOf(id) || 120));
    cy += maxH + vGap;
  }

  const out: PosMap = {};
  ids.forEach((id) => (out[id] = { x: Math.round(x[id] + dx), y: y[id] }));
  return out;
}
