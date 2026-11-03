// Builds game.json for the app: heroes (abilities, builds, win rates) and shop items.
// Data: deadlock-api.com (community API, not affiliated with Valve). Runs daily in GitHub Actions.
import { writeFileSync } from 'node:fs';

const API = 'https://api.deadlock-api.com/v1';
const DAYS = 14;
const since = Math.floor(Date.now() / 1000) - DAYS * 86400;
const get = async url => {
  const r = await fetch(url, { headers: { 'User-Agent': 'DeadlockNews-app (github.com/0ImarinI0/deadlock-program)' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
const slugify = n => String(n).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = s => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();
const descOf = d => {
  if (!d) return '';
  if (typeof d === 'string') return clean(d);
  return clean(d.desc || d.description || Object.values(d).find(v => typeof v === 'string') || '');
};
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

const [heroes, items, heroStats, itemStats] = await Promise.all([
  get(`${API}/assets/heroes?language=english`),
  get(`${API}/assets/items?language=english`),
  get(`${API}/analytics/hero-stats?min_unix_timestamp=${since}`),
  get(`${API}/analytics/item-stats?min_unix_timestamp=${since}`),
]);

const byClass = Object.fromEntries(items.map(i => [i.class_name, i]));
const hs = Object.fromEntries(heroStats.map(s => [s.hero_id, s]));
const playerMatches = heroStats.reduce((a, s) => a + (s.matches || 0), 0);
const totalMatches = Math.round(playerMatches / 12);
const is = Object.fromEntries(itemStats.map(s => [s.item_id, s]));

const outItems = items
  .filter(i => i.type === 'upgrade' && i.shopable && !i.disabled && i.item_slot_type && i.name)
  .map(i => {
    const st = is[i.id];
    return {
      id: i.id, name: i.name, slot: i.item_slot_type, tier: i.item_tier, cost: i.cost ?? null,
      active: !!i.is_active_item, desc: descOf(i.description).slice(0, 420),
      winrate: st ? pct(st.wins, st.matches) : null, players: st ? st.players ?? null : null,
    };
  })
  .sort((a, b) => a.tier - b.tier || (a.cost ?? 0) - (b.cost ?? 0) || a.name.localeCompare(b.name));
const shopIds = new Set(outItems.map(i => i.id));

const build = list => (list || [])
  .filter(x => shopIds.has(x.item_id))
  .sort((a, b) => b.pick_pct - a.pick_pct).slice(0, 6)
  .map(x => [x.item_id, Math.round(x.pick_pct), Math.round(x.winrate_pct * 10) / 10]);

const outHeroes = heroes
  .filter(h => h.name && (hs[h.id]?.matches || 0) > 1000)
  .map(h => {
    const st = hs[h.id] || {};
    const abilities = ['signature1', 'signature2', 'signature3', 'signature4']
      .map(k => byClass[h.items?.[k]]).filter(Boolean)
      .map(a => ({ name: a.name, desc: descOf(a.description).slice(0, 520) }));
    const pi = h.popular_items || {};
    return {
      id: h.id, name: h.name, slug: slugify(h.name), type: h.hero_type || null, complexity: h.complexity ?? null,
      role: clean(h.description?.role), playstyle: clean(h.description?.playstyle).slice(0, 400), tags: h.tags || [],
      matches: st.matches || 0, winrate: pct(st.wins, st.matches), pickrate: pct(st.matches, totalMatches),
      kda: st.matches ? [st.total_kills, st.total_deaths, st.total_assists].map(v => Math.round((v / st.matches) * 10) / 10) : null,
      abilities,
      build: { early: build(pi.early_game), mid: build(pi.mid_game), late: build(pi.late_game) },
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const out = {
  updated: new Date().toISOString(), days: DAYS, totalMatches,
  source: 'deadlock-api.com', heroes: outHeroes, items: outItems,
};
writeFileSync('game.json', JSON.stringify(out));
console.log(`Saved ${outHeroes.length} heroes, ${outItems.length} items, ${totalMatches} matches`);
