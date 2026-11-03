// Fetches official Deadlock news from the Steam News API and writes news.json
// Runs in GitHub Actions (Node 20+, global fetch). No dependencies.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const APP_ID = 1422450; // Deadlock
const URL = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID}&count=25&maxlength=0&format=json`;

// Steam BBCode -> blocks: ['h', text] | ['p', text] | ['list', [items]]
function toBlocks(raw) {
  let s = String(raw || '')
    .replace(/\r/g, '')
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, '')
    .replace(/\[img[^\]]*\]/gi, '')
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, '')
    .replace(/\[previewyoutube[^\]]*\][\s\S]*?\[\/previewyoutube\]/gi, '')
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\[h[1-6]\]([\s\S]*?)\[\/h[1-6]\]/gi, '\n## $1\n')
    .replace(/\[\*\]/g, '\n- ')
    .replace(/\[\/?(p|list|olist|br|hr|quote|table|tr|td|th)[^\]]*\]/gi, '\n')
    .replace(/\[\/?[a-z]+[^\]]*\]/gi, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n-[ \t]*\n+/g, '\n- ');
  const blocks = []; let list = null;
  for (let line of s.split('\n')) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('## ')) { list = null; blocks.push(['h', line.slice(3).trim()]); continue; }
    const m = line.match(/^[-*•]\s+(.*)$/);
    if (m) { if (!list) { list = []; blocks.push(['list', list]); } list.push(m[1]); continue; }
    list = null; blocks.push(['p', line]);
  }
  return blocks.filter(b => b[0] !== 'list' || b[1].length).slice(0, 400);
}

const res = await fetch(URL, { headers: { 'User-Agent': 'DeadlockNews-app-feed' } });
if (!res.ok) { console.error('Steam API error', res.status); process.exit(1); }
const data = await res.json();
const items = (data.appnews?.newsitems || [])
  .filter(n => n.feedname === 'steam_community_announcements' || /steam/i.test(n.feedlabel || ''))
  .map(n => ({
    id: 'steam-' + n.gid,
    title: n.title,
    ts: n.date * 1000,
    url: n.url,
    blocks: toBlocks(n.contents),
  }))
  .filter(n => n.title && n.blocks.length);

const out = { updated: new Date().toISOString(), source: 'Steam News API', items };
const json = JSON.stringify(out, null, 1);
// keep the file unchanged when only the timestamp would differ
if (existsSync('news.json')) {
  try { const prev = JSON.parse(readFileSync('news.json', 'utf8')); if (JSON.stringify(prev.items) === JSON.stringify(items)) { console.log('No new items'); process.exit(0); } } catch {}
}
writeFileSync('news.json', json);
console.log('Saved', items.length, 'items');
