# Frescopa App

A small installable web app (PWA) for Frescopa. It has no content of its own: everything comes from the Frescopa site on [AEM Edge Delivery Services](https://www.aem.live/), authored once in Document Authoring.

- App: https://kunwarsaluja.github.io/frescopa-app/app/ (open on a phone, then Add to Home Screen)
- Demo page (app in a phone frame, plus the content requests it makes): https://kunwarsaluja.github.io/frescopa-app/
- Site: https://main--frescopa--kunwarsaluja.aem.live/en/us/ ([repo](https://github.com/kunwarsaluja/frescopa))

## Two ways the app reuses site content

**Native screens from structured data.** The app reads JSON that the site already publishes and draws its own UI.

| Screen | Source |
|---|---|
| Offers | `/en/us/data/offers.json` (ended offers hidden, featured first, then ending soonest) |
| Shop | `/en/us/data/products.json` |
| Houses | `/en/us/data/locations.json` |
| Home, featured campaign | `/campaigns.json` query index: the campaign marked `featured`, else the most recently changed |

**Site experiences through [aem-embed](https://www.aem.live/docs/aem-embed).** Where the site already designs the experience, the app shows it with `<aem-embed>` and the site's own blocks render it.

| Where | Embedded |
|---|---|
| Home | the featured campaign fragment |
| Book a visit, a House, the trial campaign button | the booking fragments, in a bottom sheet |
| Events, Help, any other site page the app links to | the page itself |

Links inside embedded content are handled by the app: fragments open in the bottom sheet, site pages open in the app, other sites open in the browser.

## Authoring the app

The app's structure is a sheet in DA: [`/en/us/data/app.json`](https://da.live/sheet#/kunwarsaluja/frescopa/en/us/data/app). Edit it, Preview and Publish; the app picks it up on its next start. No deploy.

| Sheet | Columns | Controls |
|---|---|---|
| `shared-screens` | screen, type, title, subtitle, source, item link | What each screen shows. `type`: `home`, `offers`, `products`, `locations` or `page`. `subtitle` can use `{n}`. `item link` can use row fields, e.g. `/en/us/booking?location={id}` |
| `shared-tabs` | label, screen, icon | Bottom tabs, in order |
| `shared-actions` | label, link, icon | Home quick actions. `link` is a screen or any site path |
| `shared-links` | link, opens | Site paths that open a fragment in the bottom sheet, e.g. `/en/us/booking` → `/en/us/fragments/booking-experience` |
| `shared-labels` | key, text | UI text |

Icons: `home`, `tag`, `bag`, `person`, `pin`, `calendar`, `clock`, `chat`. EDS only publishes sheets whose names start with `shared-`.

A new screen type (a new layout) is the only change that needs code.

## Code

No build step, no runtime dependencies.

```
index.html, demo.*   demo page: the app in a phone frame + content request list
app/
  index.html         the app
  app.js             settings, tabs, navigation, link handling
  eds.js             everything that talks to the site: JSON, sheets, aem-embed
  sheet.js           bottom sheet for embedded fragments
  ui.js              el(), icons, format()
  screens/           one file per screen type
  sw.js              caches the app's own files; content always comes from the site
```

```sh
npm install
npm run lint
npm start            # http://localhost:4321
```

## Site requirements

- `access-control-allow-origin: *` on the site (headers config, path `/**`), so the app can read content and load `aem-embed` and block code.
- Site styles declare design tokens on `:root, :host`, and the booking block supports embedding ([frescopa#7](https://github.com/kunwarsaluja/frescopa/pull/7)).
