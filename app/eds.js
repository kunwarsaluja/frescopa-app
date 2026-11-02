// Everything the app reads comes from the Frescopa site on AEM Edge Delivery Services.
export const SITE = 'https://main--frescopa--kunwarsaluja.aem.live';
export const LOCALE = '/en/us';

/** Absolute URL on the site for a site path. */
export const siteUrl = (path) => new URL(path, SITE).href;

export async function getJSON(path) {
  const resp = await fetch(siteUrl(path));
  if (!resp.ok) throw new Error(`${path}: ${resp.status}`);
  return resp.json();
}

/** Rows of a single sheet, or of a query index. */
export async function getSheet(path) {
  return (await getJSON(path)).data;
}

/**
 * Rows of every sheet in a multi-sheet workbook, keyed by sheet name.
 * EDS only publishes sheets named shared-*; the prefix is dropped here.
 */
export async function getWorkbook(path) {
  const json = await getJSON(path);
  return Object.fromEntries(Object.keys(json)
    .filter((key) => key.startsWith('shared-'))
    .map((key) => [key.slice('shared-'.length), json[key].data]));
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
  loadEmbed();
  const node = document.createElement('aem-embed');
  node.setAttribute('url', siteUrl(path));
  if (query) node.dataset.query = query;
  return node;
}
