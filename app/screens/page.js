import { embed } from '../eds.js';
import { el } from '../ui.js';

/** A site page shown in the app, rendered by the site's own blocks through aem-embed. */
export default async function page(screen) {
  return el('div.page', {}, embed(screen.source));
}
