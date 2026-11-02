import { getSheet } from '../eds.js';
import { el, format, icon } from '../ui.js';

const encoded = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, encodeURIComponent(v)]));

export default async function locations(screen) {
  const rows = await getSheet(screen.source);
  return el('div.screen', {},
    el('h1', {}, screen.title),
    el('p.screen-subtitle', {}, format(screen.subtitle, { n: rows.length })),
    el('ul.places', {}, rows.map((place) => el('li', {},
      el('button.place', { type: 'button', 'data-link': format(screen['item link'], encoded(place)) },
        el('span.place-name', {}, place.name),
        el('span.place-address', {}, `${place.street}, ${place.city}`),
        el('span.place-hours', {}, icon('clock'), place.hours),
        icon('chevron'))))));
}
