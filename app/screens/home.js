import { LOCALE, embed, getSheet } from '../eds.js';
import { el, icon } from '../ui.js';

// The signed-in member. Sign-in isn't built yet, so this is a fixed member.
const MEMBER = { name: 'Alex', points: 2480, tier: 'Gold', programme: 'Frescopa Circle' };

function greeting(label) {
  const hour = new Date().getHours();
  if (hour < 12) return label('greeting-morning');
  return label(hour < 18 ? 'greeting-afternoon' : 'greeting-evening');
}

/** The campaign marked featured, else the most recently changed one. */
async function featuredCampaign(source) {
  const campaigns = (await getSheet(source))
    .filter((c) => c.path.startsWith(`${LOCALE}/`))
    .sort((a, b) => b.lastModified - a.lastModified);
  return campaigns.find((c) => c.featured === 'true') ?? campaigns[0];
}

export default async function home(screen, { label, actions }) {
  const campaign = await featuredCampaign(screen.source);
  return el('div.home', {},
    el('h1.greeting', {}, `${greeting(label)}, ${MEMBER.name}`),
    el('section.member', { 'aria-label': MEMBER.programme },
      el('p.member-programme', {}, MEMBER.programme),
      el('p.member-points', {}, el('strong', {}, MEMBER.points.toLocaleString()), ` ${label('points')}`),
      el('p.member-tier', {}, MEMBER.tier)),
    el('nav.actions', { 'aria-label': label('actions') },
      actions.map((a) => el('button.action', { type: 'button', 'data-link': a.link }, icon(a.icon), el('span', {}, a.label)))),
    campaign && el('section.featured', {},
      el('h2.section-label', {}, label('featured')),
      // the campaign block exactly as the site renders it
      embed(campaign.path)));
}
