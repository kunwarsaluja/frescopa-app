import {
  LOCALE, SITE, getWorkbook, loadEmbed,
} from './eds.js';
import { el, icon } from './ui.js';
import { closeSheet, openSheet } from './sheet.js';
import home from './screens/home.js';
import offers from './screens/offers.js';
import products from './screens/products.js';
import locations from './screens/locations.js';
import page from './screens/page.js';

// Screen layouts the app knows. The settings sheet decides which screen uses which.
const LAYOUTS = {
  home, offers, products, locations, page,
};

const view = document.getElementById('view');
const backButton = document.getElementById('back');
const tabBar = document.getElementById('tabs');
const trail = [];
let settings;

/**
 * App settings, authored in DA: /en/us/data/app.json
 * screens: screen, type, title, subtitle, source, item link
 * tabs: label, screen, icon · actions: label, link, icon
 * links: link, opens · labels: key, text
 */
async function loadSettings() {
  const book = await getWorkbook(`${LOCALE}/data/app.json`);
  settings = {
    screens: new Map(book.screens.map((s) => [s.screen, s])),
    tabs: book.tabs,
    actions: book.actions,
    links: new Map(book.links.map((l) => [l.link, l.opens])),
    labels: Object.fromEntries(book.labels.map((l) => [l.key, l.text])),
  };
}

const label = (key) => settings.labels[key] ?? '';

async function render(entry) {
  backButton.hidden = trail.length < 2;
  view.replaceChildren(el('p.status', { role: 'status' }, label('loading')));
  try {
    const screen = entry.screen
      ? settings.screens.get(entry.screen)
      : { type: 'page', source: entry.page };
    view.replaceChildren(await LAYOUTS[screen.type](screen, { label, actions: settings.actions }));
    view.scrollTo(0, 0);
  } catch (error) {
    console.error(error);
    const retry = el('button.button', { type: 'button' }, label('retry'));
    retry.addEventListener('click', () => render(entry));
    view.replaceChildren(el('div.status', { role: 'alert' }, el('p', {}, label('error')), retry));
  }
}

function go(entry, { fromTab = false } = {}) {
  if (fromTab) {
    trail.length = 0;
    tabBar.querySelectorAll('button').forEach((b) => {
      if (b.dataset.screen === entry.screen) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }
  trail.push(entry);
  render(entry);
}

/**
 * Opens a link from a screen or from embedded site content.
 * - a screen id from the settings sheet → that screen
 * - a path listed under links, or any fragment → bottom sheet (aem-embed)
 * - a path a screen already shows → that screen
 * - any other site page → in-app page (aem-embed)
 * - another site → the browser
 */
function open(link, name = '') {
  if (settings.screens.has(link)) {
    closeSheet();
    go({ screen: link });
    return;
  }
  const url = new URL(link, SITE);
  if (url.origin !== SITE) {
    window.open(url.href, '_blank', 'noopener');
    return;
  }
  const path = url.pathname;
  const sheet = settings.links.get(path) ?? (path.startsWith(`${LOCALE}/fragments/`) ? path : null);
  if (sheet) {
    openSheet(sheet, url.search.slice(1), { name, closeLabel: label('close') });
    return;
  }
  closeSheet();
  const screen = [...settings.screens.values()].find((s) => s.source === path);
  go(screen ? { screen: screen.screen } : { page: path });
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
  render(trail[trail.length - 1]);
});

function renderChrome() {
  backButton.replaceChildren(icon('back'));
  backButton.setAttribute('aria-label', label('back'));
  tabBar.replaceChildren(...settings.tabs.map((tab) => {
    const button = el('button', { type: 'button', 'data-screen': tab.screen }, icon(tab.icon), el('span', {}, tab.label));
    button.addEventListener('click', () => go({ screen: tab.screen }, { fromTab: true }));
    return button;
  }));
}

// When shown inside the demo page, report each content request so it can list them.
function reportRequests() {
  if (window.parent === window) return;
  new PerformanceObserver((list) => {
    list.getEntries()
      .filter((e) => e.name.startsWith(SITE) && /\.(json|plain\.html)(\?|$)/.test(e.name))
      .forEach((e) => window.parent.postMessage({
        type: 'content-request',
        path: e.name.slice(SITE.length),
        status: e.responseStatus,
        ms: Math.round(e.duration),
      }, window.location.origin));
  }).observe({ type: 'resource', buffered: true });
}

reportRequests();
loadEmbed();
await loadSettings();
renderChrome();
go({ screen: settings.tabs[0].screen }, { fromTab: true });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
