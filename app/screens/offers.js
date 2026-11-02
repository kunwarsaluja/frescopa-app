import { getSheet } from '../eds.js';
import { el, format } from '../ui.js';
import card from './card.js';

const time = (date, empty) => (date ? new Date(date).getTime() : empty);

/** Offers that haven't ended: featured first, then the ones ending soonest. */
function current(rows) {
  const now = Date.now();
  return rows
    .filter((o) => time(o.end, Infinity) >= now)
    .sort((a, b) => (b.featured === 'true') - (a.featured === 'true')
      || time(a.end, Infinity) - time(b.end, Infinity));
}

export default async function offers(screen) {
  const rows = current(await getSheet(screen.source));
  return el('div.screen', {},
    el('h1', {}, screen.title),
    el('p.screen-subtitle', {}, format(screen.subtitle, { n: rows.length })),
    el('div.cards', {}, rows.map((o) => card(o, { highlight: o.featured === 'true' }))));
}
