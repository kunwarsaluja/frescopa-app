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
// Site that serves embeddable blocks (aem-embed). ?site= points it at another
// environment, e.g. a feature branch or a local `aem up` during development.
const SITE = new URLSearchParams(location.search).get('site') || ORIGIN;
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
  // links ending in #_dnb stay links (same opt-out as the site's auto-blocking)
  const links = [...doc.querySelectorAll('a[href*="/fragments/"]')].filter((a) => {
    const href = a.getAttribute('href');
    if (!href.includes('#_dnb')) return true;
    a.setAttribute('href', href.replace('#_dnb', ''));
    return false;
  });
  for (const a of links) {
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

// ---- app settings, authored in DA as a sheet: /<locale>/data/app.json ----
// screens: what each screen shows and where its content comes from
// tabs / actions: bottom tabs and Home quick actions (label, screen or link, icon)
// links: site paths the app opens differently (e.g. the booking page → its booking fragment)
// labels: UI text
let settings;
const label = (key) => settings.labels[key] || '';
const fill = (template, values) => String(template || '').replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(values[k] ?? ''));

async function loadSettings() {
  const sheet = await json(`${LOCALE}/data/app.json`);
  // published multi-sheets keep the shared- prefix EDS requires on sheet names
  const rows = (name) => sheet[`shared-${name}`]?.data || [];
  settings = {
    screens: Object.fromEntries(rows('screens').map((s) => [s.screen, s])),
    tabs: rows('tabs'),
    actions: rows('actions'),
    links: Object.fromEntries(rows('links').map((l) => [l.link, l.opens])),
    labels: Object.fromEntries(rows('labels').map((l) => [l.key, l.text])),
  };
}

const ICONS = {
  home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  bag: '<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4 9 8 12 8Zm0 0s2-5 4.5-4S15 8 12 8Z"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;

async function show(builder, push = true) {
  if (push) stack.push(builder);
  backBtn.hidden = stack.length < 2;
  view.innerHTML = `<div class="loading">${esc(label('loading'))}</div>`;
  const node = await builder();
  view.innerHTML = ''; view.append(node); view.scrollTop = 0;
  refreshLog();
}
// Opens a site fragment (e.g. a booking flow) in a bottom sheet via aem-embed.
function openSheet(path, query = '', title = '') {
  const screen = document.getElementById('screen');
  screen.querySelector('.sheet')?.remove();
  const src = `book.html?${new URLSearchParams({ origin: SITE, path, query: query.replace(/^\?/, '') })}`;
  const sheet = h(`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-scrim"></div>
    <div class="sheet-panel"><div class="sheet-bar"><span class="grip"></span><button class="sheet-close" aria-label="${esc(label('close'))}">✕</button></div>
    <iframe title="${esc(title)}" src="${src}"></iframe></div></div>`);
  const close = () => { sheet.classList.add('closing'); setTimeout(() => sheet.remove(), 250); };
  sheet.querySelector('.sheet-scrim').onclick = close;
  sheet.querySelector('.sheet-close').onclick = close;
  screen.append(sheet);
}

// A link is a screen id from the settings sheet, or a site path/URL.
function open(link, title = '') {
  if (!link) return;
  if (settings.screens[link]) { show(screenBuilder(link)); return; }
  const u = new URL(link, ORIGIN);
  if (u.origin !== ORIGIN) { window.open(link); return; }
  const p = u.pathname;
  if (settings.links[p]) { openSheet(settings.links[p], u.search, title); return; }
  if (p.startsWith(`${LOCALE}/fragments/`)) { openSheet(p, u.search, title); return; }
  show(async () => (p.includes('/offers/') ? renderPage(await plain(p)) : article(await plain(p), p)));
}

// campaigns query index: every campaign fragment for this locale, newest first
async function campaignList(source) {
  const { data = [] } = await json(source);
  return data.filter((c) => c.path?.startsWith(`${LOCALE}/`)).sort((x, y) => (y.lastModified || 0) - (x.lastModified || 0));
}
async function campaignFragment(path) {
  const frag = await plain(path);
  frag.querySelectorAll('[class]').forEach((el) => { el.dataset.fragment = path; });
  return frag;
}

const greeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return label('greeting-morning');
  return label(hr < 18 ? 'greeting-afternoon' : 'greeting-evening');
};
const titleBlock = (s, n) => (s.title ? h(`<div class="screen-title fade"><h1>${esc(s.title)}</h1>${s.subtitle ? `<p>${esc(s.subtitle.replace('{n}', n))}</p>` : ''}</div>`) : document.createDocumentFragment());
const cardList = (src) => h(`<div class="offers fade" data-src="sheet ${esc(src)}"></div>`);
const price = (o) => `<div class="price">${esc(o.priceLabel)}<small>${esc(o.period)}</small><span>›</span></div>`;
const cardImg = (o) => (o.image ? `<img class="ofimg" loading="lazy" src="${media(o.image)}" alt="" onerror="this.remove()">` : '');

// Screen types. The settings sheet picks a type and a source for each screen.
const TYPES = {
  home: async (s) => {
    const f = document.createDocumentFragment();
    f.append(h(`<div class="app-native fade" data-src="app (native)">
      <p class="hello">${esc(greeting())}, Alex</p>
      <div class="loyalty"><div><span>Frescopa Circle</span><b>2,480</b><small>Velo points</small></div><div class="tier">Gold</div></div>
      <div class="quick">${settings.actions.map((a) => `<button data-go="${esc(a.link)}">${icon(a.icon)}<span>${esc(a.label)}</span></button>`).join('')}</div>
    </div>`));
    // the campaign marked featured=true, else the most recently modified one
    const list = await campaignList(s.source);
    const featured = list.find((c) => String(c.featured).toLowerCase() === 'true') || list[0];
    if (featured) {
      f.append(h(`<h2 class="label">${esc(label('featured'))}</h2>`));
      f.append(renderPage(await campaignFragment(featured.path)));
    }
    return f;
  },
  offers: async (s) => {
    const now = Date.now();
    const data = (await json(s.source)).data
      .filter((o) => !o.end || new Date(o.end).getTime() >= now)
      .sort((x, y) => (x.featured === 'true' ? -1 : 0) - (y.featured === 'true' ? -1 : 0)
        || new Date(x.end || 8.64e15) - new Date(y.end || 8.64e15));
    const f = document.createDocumentFragment();
    f.append(titleBlock(s, data.length));
    const wrap = cardList(s.source);
    data.forEach((o) => wrap.append(h(`<article class="offer ${o.featured === 'true' ? 'feat' : ''}" data-offer="${o.url}">
      ${cardImg(o)}
      <div class="top">${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : '<span></span>'}<span class="aud">${esc(o.audience)}</span></div>
      <h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p>${price(o)}</article>`)));
    f.append(wrap);
    return f;
  },
  products: async (s) => {
    const { data } = await json(s.source);
    const f = document.createDocumentFragment();
    f.append(titleBlock(s, data.length));
    const wrap = cardList(s.source);
    data.forEach((o, i) => wrap.append(h(`<article class="offer ${i === 0 ? 'feat' : ''}" data-href="${o.url}">
      ${cardImg(o)}
      <div class="top">${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : `<span class="aud">${esc(o.group)}</span>`}<span class="aud">${esc(o.category)}</span></div>
      <h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p>
      ${o.features ? `<ul class="feats">${o.features.split('|').slice(0, 3).map((x) => `<li>${esc(x.trim())}</li>`).join('')}</ul>` : ''}
      ${price(o)}</article>`)));
    f.append(wrap);
    return f;
  },
  locations: async (s) => {
    const { data } = await json(s.source);
    const f = document.createDocumentFragment();
    f.append(titleBlock(s, data.length));
    f.append(list('', data.map((l) => ({
      title: l.name, desc: `${l.street}, ${l.city} · ${l.hours} · ${l.services}`, badge: l.state || '◎', href: fill(s['item link'], l),
    })), `sheet ${s.source}`));
    return f;
  },
  page: async (s) => renderPage(await plain(s.source)),
};
const screenBuilder = (id) => () => {
  const s = settings.screens[id];
  return TYPES[s.type](s);
};

function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = settings.tabs.map((t, i) => `<button data-tab="${esc(t.screen)}" class="${i === 0 ? 'on' : ''}">${icon(t.icon)}${esc(t.label)}</button>`).join('');
}
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  stack.length = 0; show(screenBuilder(b.dataset.tab));
});
view.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]'); if (go) { open(go.dataset.go, go.textContent.trim()); return; }
  const off = e.target.closest('[data-offer]'); if (off) { const p = off.dataset.offer; show(async () => renderPage(await plain(p))); return; }
  const t = e.target.closest('[data-href]'); if (t?.dataset.href) open(t.dataset.href, t.textContent.trim());
});
backBtn.onclick = () => { stack.pop(); show(stack[stack.length - 1], false); };
document.getElementById('xray').onchange = (e) => document.getElementById('screen').classList.toggle('xray', e.target.checked);
document.getElementById('refresh').onclick = async () => {
  await loadSettings();
  renderTabs();
  await show(stack[stack.length - 1], false);
  const t = h(`<div class="toast">${esc(label('synced'))}</div>`); document.getElementById('screen').append(t); setTimeout(() => t.remove(), 1800);
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
await loadSettings();
renderTabs();
show(screenBuilder(settings.tabs[0].screen));
if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js');
