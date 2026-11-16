import { siteUrl } from '../eds.js';
import { el } from '../ui.js';

/** A tappable offer or product card. */
export default function card(item, { highlight = false, details = [] } = {}) {
  return el(`button.card${highlight ? '.highlight' : ''}`, { type: 'button', 'data-link': item.url },
    item.image && el('img', { src: siteUrl(item.image), alt: '', loading: 'lazy' }),
    el('span.card-meta', {},
      item.badge && el('span.badge', {}, item.badge),
      el('span.card-for', {}, item.audience ?? item.category)),
    el('span.card-title', {}, item.title),
    el('span.card-text', {}, item.summary),
    details.length > 0 && el('span.card-details', {}, details.map((d) => el('span', {}, d))),
    el('span.card-price', {}, item.priceLabel, item.period && el('small', {}, item.period)));
}
