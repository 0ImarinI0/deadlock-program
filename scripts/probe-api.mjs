// Probe #2: exact fields for hero abilities and shop items
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const get = u => fetch(u, { headers: { 'User-Agent': 'DeadlockNews-app' } }).then(r => r.json());
const heroes = await get('https://api.deadlock-api.com/v1/assets/heroes?only_active=true&language=english');
const items = await get('https://api.deadlock-api.com/v1/assets/items?language=english');
const h = heroes.find(x => x.name === 'Haze') || heroes[0];
const byClass = Object.fromEntries(items.map(i => [i.class_name, i]));
const short = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys || keys.includes(k)).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 300) : (v && typeof v === 'object' ? (Array.isArray(v) ? `[array ${v.length}]` : Object.keys(v).slice(0, 40)) : v)]));
const heroItems = h.items || {};
const abil = Object.entries(heroItems).map(([slot, cls]) => { const a = byClass[cls]; return a ? { slot, cls, ...short(a), description: a.description, upgrades: (a.upgrades || []).slice(0, 3) } : { slot, cls, missing: true }; });
const upgrades = items.filter(i => i.type === 'upgrade' && i.shopable !== false && !i.disabled);
const up = upgrades.find(i => i.name === 'Toxic Bullets') || upgrades[0];
const out = {
  heroKeys: Object.keys(h), heroItems, heroDesc: h.description, heroTags: h.tags, heroComplexity: h.complexity, heroType: h.hero_type,
  popular: h.popular_items && { early: (h.popular_items.early_game || []).slice(0, 3) },
  abilities: abil.slice(0, 6),
  upgradeKeys: Object.keys(up), upgradeSample: short(up), upgradeDescription: up.description,
  upgradeCounts: { total: upgrades.length, bySlot: upgrades.reduce((a, i) => (a[i.item_slot_type] = (a[i.item_slot_type] || 0) + 1, a), {}), byTier: upgrades.reduce((a, i) => (a[i.item_tier] = (a[i.item_tier] || 0) + 1, a), {}) },
  typeCounts: items.reduce((a, i) => (a[i.type] = (a[i.type] || 0) + 1, a), {}),
};
writeFileSync('data/probe.json', JSON.stringify(out, null, 1));
