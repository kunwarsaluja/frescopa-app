import { embed } from '../eds.js';
import { el, icon } from '../ui.js';

// The signed-in member. Sign-in isn't built yet, so this is a fixed member.
const MEMBER = { name: 'Alex', points: 2480, tier: 'Gold', programme: 'Frescopa Circle' };

function greeting(label) {
  const hour = new Date().getHours();
  if (hour < 12) return label('greeting-morning');
  return label(hour < 18 ? 'greeting-afternoon' : 'greeting-evening');
}

/** A site fragment, or nothing when the authored path isn't a site page. */
function fragment(path) {
  try {
    return embed(path);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default async function home(screen, { label, experience }) {
  const { announcement, featured, actions = [] } = experience;
  return el('div.home', {},
    el('h1.greeting', {}, `${greeting(label)}, ${MEMBER.name}`),
    // announcement and campaign fragments, exactly as the site renders them
    announcement && el('section.announcement', {}, fragment(announcement)),
    el('section.member', { 'aria-label': MEMBER.programme },
      el('p.member-programme', {}, MEMBER.programme),
      el('p.member-points', {}, el('strong', {}, MEMBER.points.toLocaleString()), ` ${label('points')}`),
      el('p.member-tier', {}, MEMBER.tier)),
    actions.length > 0 && el('nav.actions', { 'aria-label': label('actions') },
      actions.map((a) => el('button.action', { type: 'button', 'data-link': a.opens }, icon(a.icon), el('span', {}, a.label)))),
    featured && el('section.featured', {},
      el('h2.section-label', {}, label('featured')),
      fragment(featured)));
}
