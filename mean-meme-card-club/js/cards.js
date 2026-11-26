import { ORIGINAL_PACKS, PACK_BY_ID } from './packs.js';

export const DATASET_URL = 'https://cdn.jsdelivr.net/gh/crhallberg/json-against-humanity@latest/cah-all-compact.json';

let datasetPromise = null;

export function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch(DATASET_URL)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch((e) => { datasetPromise = null; throw e; });
  }
  return datasetPromise;
}

function groupOf(p) {
  if (!p.official) return 'Community packs';
  const n = p.name;
  if (/^CAH Base Set$|Main Deck|Family Edition/i.test(n)) return 'Base sets';
  if (/Expansion|Box Expansion|Absurd/i.test(n)) return 'Official expansions';
  if (/PAX|Holiday|Promo|Retail|Gen Con|Panel|Seasons|Desert Bus|Exclusive|Kit/i.test(n)) return 'Promos, holidays & events';
  return 'Official themed packs';
}

const GROUP_ORDER = ['Club originals', '中文原创', 'Anime, manga & manhwa', 'Base sets', 'Official expansions', 'Official themed packs', 'Promos, holidays & events', 'Community packs'];

const blanks = (t) => (t.match(/_+/g) || []).length;

export function catalogue(dataset) {
  const list = ORIGINAL_PACKS.map((p, i) => ({ id: p.id, name: p.name, group: p.group, lang: p.lang, white: p.white.length, black: p.black.length, official: false, original: true, order: i }));
  if (dataset) {
    dataset.packs.forEach((p, i) => {
      const black = p.black.filter((b) => dataset.black[b].pick <= 3).length;
      if (!p.white.length && !black) return;
      list.push({ id: 'd' + i, name: p.name, group: groupOf(p), lang: 'en', white: p.white.length, black, official: !!p.official });
    });
  }
  list.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || (a.original && b.original ? a.order - b.order : (b.white + b.black) - (a.white + a.black)));
  return { groups: GROUP_ORDER.filter((g) => list.some((p) => p.group === g)), packs: list };
}

export function presetPacks(cat, preset) {
  if (preset === 'base') {
    const base = cat.packs.find((p) => p.name === 'CAH Base Set');
    return base ? [base.id] : ['s'];
  }
  if (preset === 'zh') return cat.packs.filter((p) => p.lang === 'zh').map((p) => p.id);
  if (preset === 'anime') return cat.packs.filter((p) => p.group === 'Anime, manga & manhwa').map((p) => p.id);
  if (preset === 'official') return cat.packs.filter((p) => p.official).map((p) => p.id);
  if (preset === 'all') return cat.packs.filter((p) => p.lang === 'en').map((p) => p.id);
  return ['s'];
}

export function packLangs(packIds) {
  return [...new Set(packIds.map((id) => PACK_BY_ID[id]?.lang || 'en'))];
}

export function buildLibrary(dataset, packIds) {
  const white = [];
  const black = [];
  const seenW = new Set();
  const seenB = new Set();
  const addW = (t) => { const k = t.trim(); if (k && !seenW.has(k)) { seenW.add(k); white.push(k); } };
  const addB = (t, pick) => {
    const k = t.trim();
    const p = Math.max(1, Math.min(3, pick || blanks(k) || 1));
    if (k && !seenB.has(k)) { seenB.add(k); black.push({ text: k, pick: p }); }
  };
  for (const id of packIds) {
    const own = PACK_BY_ID[id];
    if (own) {
      own.white.forEach(addW);
      own.black.forEach((t) => addB(t, blanks(t) || 1));
      continue;
    }
    if (!dataset) continue;
    const p = dataset.packs[Number(id.slice(1))];
    if (!p) continue;
    p.white.forEach((i) => addW(dataset.white[i]));
    p.black.forEach((i) => { const b = dataset.black[i]; if (b.pick <= 3) addB(b.text, b.pick); });
  }
  return { white, black };
}

export function packNames(dataset, packIds) {
  return packIds.map((id) => PACK_BY_ID[id]?.name || dataset?.packs[Number(id.slice(1))]?.name).filter(Boolean);
}

export const needsDataset = (packIds) => packIds.some((id) => !PACK_BY_ID[id]);
