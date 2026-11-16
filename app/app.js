import {
  EXPERIENCE, LOCAL, LOCALE, PREVIEW, SITE, getExperience, loadEmbed,
} from './eds.js';
import { el, icon } from './ui.js';
import { closeSheet, openSheet } from './sheet.js';
import home from './screens/home.js';
import offers from './screens/offers.js';
import products from './screens/products.js';
import locations from './screens/locations.js';
import page from './screens/page.js';

// The app's screens. Layout and data source are code; their text, the tabs and the
// quick actions come from the app document authors edit in DA (Frescopa Studio).
const SCREENS = {
  home: { layout: home },
  offers: { layout: offers, source: `${LOCALE}/data/offers.json` },
  shop: { layout: products, source: `${LOCALE}/data/products.json` },
  houses: {
    layout: locations,
    source: `${LOCALE}/data/locations.json`,
    itemLink: `${LOCALE}/booking?location={id}`,
  },
};

// Frescopa Studio is a DA app: DA serves it from its preview host for the site's
// branch (and from `aem up` on localhost:3000 with ?ref=local while developing it).
const STUDIO_ORIGIN = /^https:\/\/[a-z0-9-]+--frescopa--kunwarsaluja\.preview\.da\.live$/;
const fromStudio = (event) => event.source === window.parent && window.parent !== window
  && (STUDIO_ORIGIN.test(event.origin) || (LOCAL && event.origin === 'http://localhost:3000'));

const view = document.getElementById('view');
const backButton = document.getElementById('back');
const tabBar = document.getElementById('tabs');
const trail = [];
let experience;
let latestRender = 0;

const label = (key) => experience.labels?.[key] ?? '';

/** An app screen (its title and subtitle come from content), or a site page shown in the app. */
function screenFor(opens) {
  if (SCREENS[opens]) {
    const { title, subtitle } = experience[opens] ?? {};
    return { ...SCREENS[opens], title, subtitle };
  }
  return { layout: page, source: opens };
}

async function render(opens) {
  // a slower, older render must not replace a newer screen
  const id = latestRender + 1;
  latestRender = id;
  backButton.hidden = trail.length < 2;
  view.replaceChildren(el('p.status', { role: 'status' }, label('loading')));
  try {
    const screen = screenFor(opens);
    const content = await screen.layout(screen, { label, experience });
    if (id !== latestRender) return;
    view.replaceChildren(content);
    view.scrollTo(0, 0);
  } catch (error) {
    if (id !== latestRender) return;
    console.error(error);
    const retry = el('button.button', { type: 'button' }, label('retry'));
    retry.addEventListener('click', () => render(opens));
    view.replaceChildren(el('div.status', { role: 'alert' }, el('p', {}, label('error')), retry));
  }
}

function markTab() {
  tabBar.querySelectorAll('button').forEach((b) => {
    if (b.dataset.opens === trail[0]) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function go(opens, { fromTab = false } = {}) {
  if (fromTab) trail.length = 0;
  trail.push(opens);
  markTab();
  render(opens);
}

/**
 * Opens a link from a screen or from embedded site content.
 * - an app screen → that screen
 * - a page listed under "Open in a bottom sheet", or any fragment → bottom sheet (aem-embed)
 * - any other site page → in-app page (aem-embed)
 * - another site → the browser
 */
function open(link, name = '', { fromTab = false } = {}) {
  if (SCREENS[link]) {
    closeSheet();
    go(link, { fromTab });
    return;
  }
  const url = new URL(link, SITE);
  if (url.origin !== SITE) {
    if (/^https?:$/.test(url.protocol)) window.open(url.href, '_blank', 'noopener');
    return;
  }
  const path = url.pathname;
  const sheet = experience.sheets?.find((s) => s.page === path)?.fragment
    ?? (path.startsWith(`${LOCALE}/fragments/`) ? path : null);
  if (sheet) {
    openSheet(sheet, url.search.slice(1), { name, closeLabel: label('close') });
    return;
  }
  closeSheet();
  go(path, { fromTab });
}

// One click handler for app links and links inside embedded site content.
// Links in an embed are root-relative to the site, so they are resolved against SITE
// here instead of the app's own address. Runs in the capture phase so embedded
// site code (e.g. its fragment modal) doesn't also handle the click.
document.addEventListener('click', (event) => {
  const target = event.composedPath()
    .find((node) => node instanceof Element && (node.matches('a[href]') || node.dataset.link));
  if (!target) return;
  const link = target.dataset.link ?? target.getAttribute('href');
  if (!link || /^(#|mailto:|tel:)/.test(link)) return;
  event.preventDefault();
  event.stopPropagation();
  open(link, target.textContent.trim());
}, true);

backButton.addEventListener('click', () => {
  trail.pop();
  markTab();
  render(trail[trail.length - 1]);
});

function renderChrome() {
  backButton.replaceChildren(icon('back'));
  backButton.setAttribute('aria-label', label('back'));
  tabBar.replaceChildren(...experience.tabs.map((tab) => {
    const button = el('button', { type: 'button', 'data-opens': tab.opens }, icon(tab.icon), el('span', {}, tab.label));
    button.addEventListener('click', () => open(tab.opens, tab.label, { fromTab: true }));
    return button;
  }));
  markTab();
}

function start() {
  renderChrome();
  open(experience.tabs[0].opens, experience.tabs[0].label, { fromTab: true });
}

/**
 * In preview, Frescopa Studio sends the author's unsaved changes so the app updates as
 * they type: { type: 'structured-content', path, data } for the document it edits.
 * Studio's draft also starts the app when the document isn't previewed yet.
 */
function listenToStudio() {
  window.addEventListener('message', (event) => {
    const { type, path, data } = event.data ?? {};
    if (!fromStudio(event) || type !== 'structured-content' || path !== `${LOCALE}/app/experience`) return;
    // a draft without tabs is mid-edit (the schema requires them): keep showing the last one
    if (!data?.tabs?.length) return;
    const first = !experience;
    experience = data;
    if (first) {
      start();
      return;
    }
    renderChrome();
    render(trail[trail.length - 1]);
  });
  // tell Studio the app is ready for changes (no data in this message)
  window.parent.postMessage({ type: 'structured-content-ready' }, '*');
}

/** The demo page (same origin) that frames the app, if any; not Studio. */
function demoPage() {
  try {
    return window.parent !== window && window.parent.location.origin === window.location.origin;
  } catch {
    return false; // a parent on another origin, e.g. Frescopa Studio
  }
}

// When shown inside the demo page, report each content request so it can list them.
function reportRequests() {
  if (!demoPage()) return;
  new PerformanceObserver((list) => {
    list.getEntries()
      .map((e) => {
        if (e.name.startsWith(EXPERIENCE)) return { e, path: `${LOCALE}/app/experience (app document)` };
        if (e.name.startsWith(SITE) && /\.(json|plain\.html)(\?|$)/.test(e.name)) return { e, path: e.name.slice(SITE.length) };
        return null;
      })
      .filter(Boolean)
      .forEach(({ e, path }) => window.parent.postMessage({
        type: 'content-request',
        path,
        status: e.responseStatus,
        ms: Math.round(e.duration),
      }, window.location.origin));
  }).observe({ type: 'resource', buffered: true });
}

reportRequests();
loadEmbed();
if (PREVIEW) listenToStudio();
try {
  const saved = await getExperience();
  // in preview, Studio's draft may have arrived first: it's newer, so keep it
  if (!experience) {
    experience = saved;
    start();
  }
} catch (error) {
  console.error(error);
  if (!experience) {
    view.replaceChildren(document.getElementById('start-error').content.cloneNode(true));
    view.querySelector('button').addEventListener('click', () => window.location.reload());
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
