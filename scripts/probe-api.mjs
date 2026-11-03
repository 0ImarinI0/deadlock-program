// One-off probe: saves the shape of deadlock-api responses to data/probe.json
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const since = Math.floor(Date.now() / 1000) - 30 * 86400;
const urls = {
  heroes: 'https://api.deadlock-api.com/v1/assets/heroes?only_active=true&language=english',
  items: 'https://api.deadlock-api.com/v1/assets/items?language=english',
  heroStats: `https://api.deadlock-api.com/v1/analytics/hero-stats?min_unix_timestamp=${since}`,
  itemStats: `https://api.deadlock-api.com/v1/analytics/item-stats?min_unix_timestamp=${since}`,
  abilities: 'https://api.deadlock-api.com/v1/assets/abilities?language=english',
};
const cut = (v, d = 0) => {
  if (Array.isArray(v)) return { _array: v.length, first: cut(v[0], d + 1) };
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v).slice(0, 60)) o[k] = d > 3 ? (typeof x) : cut(x, d + 1); return o; }
  return typeof v === 'string' ? v.slice(0, 160) : v;
};
const out = {};
for (const [k, u] of Object.entries(urls)) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'DeadlockNews-app (github.com/0ImarinI0/deadlock-program)' } });
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
    out[k] = { url: u, status: r.status, cors: r.headers.get('access-control-allow-origin'), bytes: text.length, sample: j ? cut(j) : text.slice(0, 400) };
    if (Array.isArray(j) && j.length) out[k].names = j.slice(0, 80).map(x => [x.id ?? x.hero_id ?? x.heroId, x.name ?? x.class_name, x.type, x.item_slot_type]);
  } catch (e) { out[k] = { url: u, error: String(e) }; }
}
writeFileSync('data/probe.json', JSON.stringify(out, null, 1));
