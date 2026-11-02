import { getSheet } from '../eds.js';
import { el, format } from '../ui.js';
import card from './card.js';

export default async function products(screen) {
  const rows = await getSheet(screen.source);
  return el('div.screen', {},
    el('h1', {}, screen.title),
    el('p.screen-subtitle', {}, format(screen.subtitle, { n: rows.length })),
    el('div.cards', {}, rows.map((p) => card(p, {
      details: p.features ? p.features.split('|').map((f) => f.trim()).slice(0, 3) : [],
    }))));
}
