// Headless Frescopa app: reads AEM Edge Delivery content (.plain.html + query-index.json) and renders native-style UI.
const ORIGIN = 'https://main--frescopa--kunwarsaluja.aem.live';
// EDS sends Access-Control-Allow-Origin: *, so the app calls it directly.
// ?proxy routes through the optional local server.mjs instead.
const PROXY = new URLSearchParams(location.search).has('proxy');
const DIRECT = !PROXY;
const BASE = DIRECT ? ORIGIN : '/eds';
// sheet media paths (/media/x.jpg) are redirects that currently resolve on preview only
const MEDIA = DIRECT ? ORIGIN.replace('.aem.live', '.aem.page') : '/edspage';
const media = (p) => (p ? (p.startsWith('http') ? p : `${MEDIA}${p}`) : '');
const LOCALE = '/en/us';
const view = document.getElementById('view');
const backBtn = document.getElementById('back');
const stack = [];

const plain = async (path) => {
  const p = path.endsWith('/') ? `${path}index` : path;
  const r = await fetch(`${BASE}${p}.plain.html`, { cache: 'no-store' });
  const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
  // rewrite relative media to the EDS origin (through proxy when needed)
  const dir = p.slice(0, p.lastIndexOf('/') + 1);
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src?.startsWith('./')) img.src = `${BASE}${dir}${src.slice(2).replace('width=750', 'width=750')}`;
    else if (src?.startsWith('/')) img.src = `${BASE}${src}`;
  });
  // inline fragments, same as the web's auto-blocking of /fragments/* links
  for (const a of [...doc.querySelectorAll('a[href*="/fragments/"]')]) {
    const frag = await plain(new URL(a.getAttribute('href'), ORIGIN).pathname);
    [...frag.querySelectorAll('[class]')].filter((el) => el.parentElement === frag.firstElementChild || el.parentElement?.parentElement === frag)
      .forEach((el) => { el.dataset.fragment = new URL(a.getAttribute('href'), ORIGIN).pathname; });
    const host = a.closest('p') || a;
    host.replaceWith(...[...frag.children].flatMap((sec) => [...sec.children]));
  }
  return doc.body;
};
// record content requests for the side panel
const reqlog = [];
const nativeFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const t = performance.now();
  const r = await nativeFetch(url, opts);
  const u = new URL(url, location.href);
  if (!/\.(woff2|jpg|png|webp)/.test(u.pathname)) reqlog.unshift({ path: u.pathname.replace(/^\/eds(page)?/, ''), status: r.status, ms: Math.round(performance.now() - t), at: Date.now() });
  reqlog.length = Math.min(reqlog.length, 30);
  return r;
};
const json = async (p) => (await fetch(`${BASE}${p}`, { cache: 'no-store' })).json();
const index = async () => (await (await fetch(`${BASE}/query-index.json?limit=500`, { cache: 'no-store' })).json()).data;
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (el) => el?.textContent.trim() || '';
const img = (el) => el?.querySelector('img')?.src;
const link = (el) => el?.querySelector('a')?.getAttribute('href');

function heroFrom(block, src) {
  const im = img(block);
  const h1 = block.querySelector('h1, h2');
  const ps = [...block.querySelectorAll('p')].filter((p) => !p.querySelector('a') && !p.querySelector('picture'));
  const a = block.querySelector('strong a, a');
  return h(`<div class="hero fade" data-src="${src}">${im ? `<img src="${im}" alt="">` : ''}<div class="txt">
    ${ps[0] && ps[0].compareDocumentPosition(h1) & 4 ? `<p class="eyebrow">${esc(text(ps.shift()))}</p>` : ''}
    <h1>${h1?.innerHTML || ''}</h1>${ps[0] ? `<p>${esc(text(ps[0]))}</p>` : ''}
    ${a ? `<button class="cta" data-href="${a.getAttribute('href')}">${esc(text(a))}</button>` : ''}
    ${block.querySelector('li') ? `<div class="perks">${[...block.querySelectorAll('li')].map((li) => `<span><b>${esc(text(li.querySelector('strong')))}</b>${esc(text(li).replace(text(li.querySelector('strong')), ''))}</span>`).join('')}</div>` : ''}</div></div>`);
}
function rail(title, items, src) {
  const sec = h(`<section class="sec fade" data-src="${src}">${title ? `<h2>${esc(title)}</h2>` : ''}<div class="rail"></div></section>`);
  items.forEach((it) => sec.querySelector('.rail').append(h(`<article class="card ${it.img ? '' : 'noimg'}" data-href="${it.href || ''}">
    ${it.img ? `<img loading="lazy" src="${it.img}" alt="">` : ''}<div class="b"><h3>${esc(it.title)}</h3><p>${esc(it.desc || '')}</p></div></article>`)));
  return sec;
}
function list(title, items, src) {
  const sec = h(`<section class="sec fade" data-src="${src}">${title ? `<h2>${esc(title)}</h2>` : ''}<div class="list"></div></section>`);
  items.forEach((it) => sec.querySelector('.list').append(h(`<div class="row" data-href="${it.href || ''}"><div class="ic">${esc(it.badge || '✦')}</div>
    <div><h3>${esc(it.title)}</h3><p>${esc(it.desc || '')}</p></div></div>`)));
  return sec;
}
const rowsOf = (block) => [...block.children].map((row) => [...row.children]);
function cardItems(block) {
  return rowsOf(block).map((cells) => {
    const all = cells.length === 1 ? cells[0] : null;
    const imCell = cells.find((c) => c.querySelector('img'));
    const body = cells.find((c) => c !== imCell) || all;
    const head = body?.querySelector('h2,h3,h4,strong') || body;
    const desc = [...(body?.querySelectorAll('p') || [])].map(text).find((t) => t && t !== text(head));
    return { title: text(head), desc, img: img(imCell || all), href: link(body) };
  }).filter((i) => i.title);
}

// Map any EDS page's sections/blocks to app components
function renderPage(body, { compactHero = false } = {}) {
  const out = document.createDocumentFragment();
  [...body.children].forEach((section) => {
    let heading = '';
    [...section.children].forEach((el) => {
      const cls = el.classList;
      const name = cls[0];
      if (/^H[1-3]$/.test(el.tagName) && !el.closest('[class]')) { heading = text(el); return; }
      if (!name) return;
      const src = `${el.dataset.fragment ? `fragment ${el.dataset.fragment} → ` : ''}${name}${cls.length > 1 ? ` (${[...cls].slice(1).join(' ')})` : ''}`;
      if (name === 'hero' || name === 'campaign') out.append(heroFrom(el, src));
      else if (name === 'cards' || name === 'related-articles' || name === 'product-grid') out.append(rail(heading, cardItems(el), src));
      else if (name === 'events') {
        out.append(list(heading, rowsOf(el).map((cells) => {
          const all = cells.map(text);
          return { title: text(el.querySelector && cells.map((c) => c.querySelector('h3')).find(Boolean)), desc: [...cells.flatMap((c) => [...c.querySelectorAll('p')]).map(text).filter((t) => t.length > 12), all[2]].filter(Boolean).slice(0, 2).join(' · '), badge: /^\d{4}-/.test(all[0]) ? new Date(all[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '✦', href: cells.map(link).find(Boolean) };
        }).filter((i) => i.title), src));
      } else if (name === 'stats') {
        const s = h(`<section class="sec fade" data-src="${src}">${heading ? `<h2>${esc(heading)}</h2>` : ''}<div class="stats"></div></section>`);
        rowsOf(el).forEach((cells) => { const t = cells.map(text); s.querySelector('.stats').append(h(`<div><b>${esc(t[0])}</b><span>${esc(t.slice(1).join(' '))}</span></div>`)); });
        out.append(s);
      } else if (['offer-summary', 'faq', 'steps', 'columns', 'quote', 'timeline'].includes(name)) {
        const items = rowsOf(el).map((cells) => ({ title: text(cells[0]).slice(0, 80), desc: cells.slice(1).map(text).join(' ').slice(0, 120) })).filter((i) => i.title && i.desc && !/^[a-z-]+$/.test(i.title));
        if (items.length) out.append(list(heading || text(el.querySelector('h2')), items, src));
      }
      heading = '';
    });
  });
  return out;
}

function article(body, path) {
  const wrap = h(`<div class="article fade" data-src="${path}.plain.html"></div>`);
  const hero = body.querySelector('.hero');
  if (hero) { wrap.before?.(); }
  [...body.children].forEach((section) => [...section.children].forEach((el) => {
    if (el.classList.contains('hero')) { const im = img(el); if (im) wrap.append(h(`<img src="${im}" alt="">`)); el.querySelectorAll('h1,p').forEach((x) => !x.querySelector('picture') && wrap.append(x.cloneNode(true))); return; }
    if (el.className && el.children.length) {
      const rows = rowsOf(el);
      if (rows.every((r) => r.length === 2)) { const kv = h('<div class="kv"></div>'); rows.forEach(([k, v]) => kv.append(h(`<b>${esc(text(k))}</b>`), h(`<span>${esc(text(v))}</span>`))); wrap.append(kv); return; }
      el.querySelectorAll('h2,h3,p,ul,img').forEach((x) => { if (x.tagName === 'IMG') wrap.append(h(`<img src="${x.src}" alt="">`)); else if (!x.closest('ul') || x.tagName === 'UL') wrap.append(x.cloneNode(true)); });
      return;
    }
    wrap.append(el.cloneNode(true));
  }));
  wrap.querySelectorAll('picture source').forEach((s) => s.remove());
  return wrap;
}

async function show(builder, push = true) {
  if (push) stack.push(builder);
  backBtn.hidden = stack.length < 2;
  view.innerHTML = '<div class="loading">Brewing something fresh…</div>';
  const node = await builder();
  view.innerHTML = ''; view.append(node); view.scrollTop = 0;
  refreshLog();
}
const open = (href) => {
  if (!href) return;
  const u = new URL(href, ORIGIN);
  if (u.origin !== ORIGIN) return window.open(href);
  const p = u.pathname;
  show(async () => (p.includes('/offers/') ? renderPage(await plain(p)) : article(await plain(p), p)));
};

// campaigns query index (/campaigns.json): every campaign fragment for this locale, newest first
async function campaignList() {
  try {
    const { data = [] } = await json('/campaigns.json');
    return data.filter((c) => c.path?.startsWith(`${LOCALE}/`)).sort((x, y) => (y.lastModified || 0) - (x.lastModified || 0));
  } catch { return []; }
}
async function campaignFragment(path) {
  const frag = await plain(path);
  frag.querySelectorAll('[class]').forEach((el) => { el.dataset.fragment = path; });
  return frag;
}

const tabs = {
  home: async () => {
    const f = document.createDocumentFragment();
    // app-owned content (lives in the app)
    f.append(h(`<div class="app-native fade" data-src="app (native)">
      <p class="hello">Good morning, Alex</p>
      <div class="loyalty"><div><span>Circle · Gold</span><b>2,480</b><small>Velo points</small></div><div class="qr">▦</div></div>
      <div class="quick"><button data-go="offers">✦<span>Offers</span></button><button data-go="houses">📍<span>Houses</span></button><button data-go="events">🎟<span>Events</span></button><button data-go="help">💬<span>Help</span></button></div>
    </div>`));
    // EDS content: the one campaign marked featured=true in the campaigns query index
    const featured = (await campaignList()).find((c) => String(c.featured).toLowerCase() === 'true');
    if (featured) {
      f.append(h('<h2 class="label">Featured offer · from AEM</h2>'));
      f.append(renderPage(await campaignFragment(featured.path)));
    }
    return f;
  },
  offers: async () => {
    // same sheet the website's catalog block reads: /en/us/data/offers.json
    const { data } = await json(`${LOCALE}/data/offers.json`);
    const campaigns = await campaignList();
    const f = document.createDocumentFragment();
    f.append(h(`<div class="screen-title fade"><h1>Offers</h1><p>${campaigns.length} campaigns · ${data.length} offers</p></div>`));
    if (campaigns.length) {
      f.append(h('<h2 class="label">Campaigns · from campaigns.json</h2>'));
      (await Promise.all(campaigns.map((c) => campaignFragment(c.path)))).forEach((fr) => f.append(renderPage(fr)));
      f.append(h('<h2 class="label">All offers · from offers.json</h2>'));
    }
    const wrap = h('<div class="offers fade" data-src="sheet /en/us/data/offers.json"></div>');
    data.forEach((o) => wrap.append(h(`<article class="offer ${o.featured === 'true' ? 'feat' : ''}" data-offer="${o.url}">
      ${o.image ? `<img class="ofimg" loading="lazy" src="${media(o.image)}" alt="" onerror="this.remove()">` : ''}
      <div class="top"><span class="badge">${esc(o.badge)}</span><span class="aud">${esc(o.audience)}</span></div>
      <h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p>
      <div class="price">${esc(o.priceLabel)}<small>${esc(o.period)}</small><span>›</span></div></article>`)));
    f.append(wrap);
    return f;
  },
  shop: async () => {
    const { data } = await json(`${LOCALE}/data/products.json`);
    const f = document.createDocumentFragment();
    f.append(h(`<div class="screen-title fade"><h1>Shop</h1><p>${data.length} plans & products · from products.json</p></div>`));
    const wrap = h('<div class="offers fade" data-src="sheet /en/us/data/products.json"></div>');
    data.forEach((o, i) => wrap.append(h(`<article class="offer ${i === 0 ? 'feat' : ''}" data-href="${o.url}">
      ${o.image ? `<img class="ofimg" loading="lazy" src="${media(o.image)}" alt="" onerror="this.remove()">` : ''}
      <div class="top">${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : `<span class="aud">${esc(o.group)}</span>`}<span class="aud">${esc(o.category)}</span></div>
      <h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p>
      ${o.features ? `<ul class="feats">${o.features.split('|').slice(0, 3).map((x) => `<li>${esc(x.trim())}</li>`).join('')}</ul>` : ''}
      <div class="price">${esc(o.priceLabel)}<small>${esc(o.period)}</small><span>›</span></div></article>`)));
    f.append(wrap);
    return f;
  },
  houses: async () => {
    const { data } = await json(`${LOCALE}/data/locations.json`);
    const f = document.createDocumentFragment();
    f.append(h(`<div class="screen-title fade"><h1>Frescopa Houses</h1><p>${data.length} locations · from locations.json</p></div>`));
    f.append(list('', data.map((l) => ({ title: l.name, desc: `${l.street}, ${l.city} · ${l.hours} · ${l.services}`, badge: l.state || '◎', href: `${LOCALE}/booking` })), 'sheet /en/us/data/locations.json'));
    return f;
  },
  events: async () => renderPage(await plain(`${LOCALE}/experiences`)),
  help: async () => renderPage(await plain(`${LOCALE}/support`)),
  explore: async () => {
    const data = (await index()).filter((d) => d.path.startsWith(LOCALE) && !/\/(nav|footer)$/.test(d.path));
    const f = document.createDocumentFragment();
    const groups = { 'Stories & guides': /stories|guides|explore|whats-new/, 'Products & services': /products|services|collections/, 'Experiences': /events|experiences|booking|locations/ };
    Object.entries(groups).forEach(([g, re]) => {
      const items = data.filter((d) => re.test(d.path)).map((d) => ({ title: d.title.split(' | ')[0], desc: d.description, img: d.image?.includes('default-meta') ? '' : d.image.replace(ORIGIN, BASE), href: d.path }));
      if (items.length) f.append(rail(g, items, 'query-index.json'));
    });
    return f;
  },
  circle: async () => renderPage(await plain(`${LOCALE}/membership/benefits`)),
};
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  stack.length = 0; show(tabs[b.dataset.tab]);
});
view.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]'); if (go) { show(tabs[go.dataset.go]); return; }
  const off = e.target.closest('[data-offer]'); if (off) { const p = off.dataset.offer; show(async () => renderPage(await plain(p))); return; }
  const t = e.target.closest('[data-href]'); if (t?.dataset.href) open(t.dataset.href);
});
backBtn.onclick = () => { stack.pop(); show(stack[stack.length - 1], false); };
document.getElementById('xray').onchange = (e) => document.getElementById('screen').classList.toggle('xray', e.target.checked);
document.getElementById('refresh').onclick = async () => {
  await show(stack[stack.length - 1], false);
  const t = h('<div class="toast">You’re all caught up ✓</div>'); document.getElementById('screen').append(t); setTimeout(() => t.remove(), 1800);
};

let lastShown = 0;
function refreshLog() {
  const ul = document.getElementById('reqlog');
  ul.innerHTML = reqlog.slice(0, 12).map((l) => `<li class="${l.at > lastShown ? 'new' : ''}"><span class="s">${l.status}</span><span class="u">${l.path}</span><span>${l.ms}ms</span></li>`).join('');
  lastShown = Date.now();
}
// light polling so a publish shows up without reloading the app
setInterval(async () => {
  try { const d = await index(); const latest = Math.max(...d.map((x) => x.lastModified)); if (window.lastMod && latest > window.lastMod) document.getElementById('refresh').click(); window.lastMod = latest; } catch { /* offline */ }
}, 30000);
show(tabs.home);
if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js');
