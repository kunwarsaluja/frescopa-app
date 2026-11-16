// Everything the app reads comes from the Frescopa site on AEM Edge Delivery Services.
// It shows published content. With ?preview it shows previewed content instead:
// that's how Frescopa Studio shows authors their changes before they publish.
const ORG = 'kunwarsaluja';
const SITE_NAME = 'frescopa';
export const PREVIEW = new URLSearchParams(window.location.search).has('preview');
// While developing (app on localhost), site code and content come from `aem up` on
// localhost:3000, so site changes can be tried with the app before they're pushed.
export const LOCAL = window.location.hostname === 'localhost';
export const SITE = LOCAL
  ? 'http://localhost:3000'
  : `https://main--${SITE_NAME}--${ORG}.aem.${PREVIEW ? 'page' : 'live'}`;
export const LOCALE = '/en/us';

// The app document: tabs, quick actions, featured campaign, screen text and labels.
// Authored as structured content in DA and delivered as JSON.
// See https://www.aem.live/docs/ew/administering/structured-content
export const EXPERIENCE = `https://da-sc.adobeaem.workers.dev/${PREVIEW ? 'preview' : 'live'}/${ORG}/${SITE_NAME}${LOCALE}/app/experience`;

/**
 * Absolute URL on the site for a site path. Anything that resolves to another host
 * (e.g. `//host/x` or a full URL) is refused: aem-embed runs the code of the site it
 * embeds, so content must never be able to point the app at another site.
 */
export function siteUrl(path) {
  const url = new URL(path, SITE);
  if (url.origin !== SITE) throw new Error(`not a site path: ${path}`);
  return url.href;
}

export async function getJSON(path) {
  const resp = await fetch(siteUrl(path));
  if (!resp.ok) throw new Error(`${path}: ${resp.status}`);
  return resp.json();
}

/** Rows of a single sheet, or of a query index. */
export async function getSheet(path) {
  return (await getJSON(path)).data;
}

/** The app document's data. */
export async function getExperience() {
  const resp = await fetch(EXPERIENCE, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`app document: ${resp.status}`);
  return (await resp.json()).data;
}

let embedReady;
/**
 * Loads the aem-embed web component and the site's fonts, once.
 * See https://www.aem.live/docs/aem-embed
 */
export function loadEmbed() {
  if (!embedReady) {
    // @font-face does not apply inside shadow DOM, so the host page loads the site fonts
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = siteUrl('/styles/fonts.css');
    document.head.append(fonts);
    embedReady = import(siteUrl('/scripts/aem-embed.js'));
  }
  return embedReady;
}

/**
 * An <aem-embed> for a site page or fragment, rendered by the site's own code.
 * @param {string} path site path, e.g. /en/us/fragments/booking-experience
 * @param {string} [query] prefill values for blocks that read them (booking)
 */
export function embed(path, query = '') {
  const url = siteUrl(path);
  loadEmbed();
  const node = document.createElement('aem-embed');
  node.setAttribute('url', url);
  if (query) node.dataset.query = query;
  return node;
}
