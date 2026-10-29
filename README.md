# Frescopa App

A small installable web app (PWA) that shows **content reuse across channels**: everything it displays comes live from the Frescopa site on [AEM Edge Delivery Services](https://www.aem.live/), with no CMS of its own.

- Site: https://main--frescopa--kunwarsaluja.aem.live/en/us/
- Site repo: [kunwarsaluja/frescopa](https://github.com/kunwarsaluja/frescopa)

## What comes from where

| App screen | EDS source |
|---|---|
| Home → featured offer | fragment `/en/us/fragments/campaigns/member-week-nov39.plain.html` (same one the web homepage embeds) |
| Offers | sheet `/en/us/data/offers.json`; tapping an offer opens its page (`.plain.html`) |
| Houses | sheet `/en/us/data/locations.json` |
| Shop | sheet `/en/us/data/products.json` |
| Events | events block on `/en/us/experiences.plain.html` |
| Help | `/en/us/support.plain.html` |
| Circle | `/en/us/membership/benefits.plain.html` |

Greeting, points card and quick actions are app-owned (not from EDS).

The app reads `.plain.html` (pages and fragments without site chrome) and JSON sheets, then maps EDS blocks (`hero`, `campaign`, `cards`, `events`, `stats`, `offer-summary`, `faq`…) to native-style components. Turn on **X-ray** on desktop to see which block or sheet each component came from.

The site sends `Access-Control-Allow-Origin: *`, so the app calls EDS directly from the browser.

Known gap: sheet image paths like `/media/com-sun.jpg` are redirects that resolve only on `.aem.page` today, so those images load from preview.

## Run locally

No build step, no dependencies.

```sh
python3 -m http.server 4321   # or any static server
open http://localhost:4321
```

`server.mjs` is an optional zero-dependency Node server that also proxies EDS (`node server.mjs`, then open `/?proxy`). Only needed if CORS is ever turned off on the site.

## Desktop vs phone

- Desktop: phone frame with the live request log, Sync now and X-ray beside it.
- Phone or installed (Add to Home Screen): full-screen app. A service worker caches the app shell; EDS content is always fetched fresh (network-first, cached copy only when offline).

## Hosting

GitHub Pages from `main` (root). Every push redeploys.

## Next steps

- Wrap with Capacitor for iOS/Android store builds, or build native clients against the same endpoints.
- Push notifications when an offer is published.
