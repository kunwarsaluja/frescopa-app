# Frescopa App

A small installable web app (PWA) that shows **content reuse across channels**: everything it displays comes live from the Frescopa site on [AEM Edge Delivery Services](https://www.aem.live/), with no CMS of its own.

- **App: https://kunwarsaluja.github.io/frescopa-app/** (open on a phone and use Add to Home Screen to install)
- Site: https://main--frescopa--kunwarsaluja.aem.live/en/us/
- Site repo: [kunwarsaluja/frescopa](https://github.com/kunwarsaluja/frescopa)

## What comes from where

| App screen | EDS source |
|---|---|
| Home → featured offer | the campaign fragment marked `featured: true` in the `/campaigns.json` query index (if none is featured, the most recently modified campaign) |
| Offers | all offers from `/en/us/data/offers.json`; tapping an offer opens its page (`.plain.html`) |
| Houses | sheet `/en/us/data/locations.json` |
| Shop | sheet `/en/us/data/products.json` |
| Events | events block on `/en/us/experiences.plain.html` |
| Help | `/en/us/support.plain.html` |
| Circle | `/en/us/membership/benefits.plain.html` |

Greeting, points card and quick actions are app-owned (not from EDS).

### Booking with aem-embed

Links to `/en/us/booking` (House rows, events) and to fragments (for example the trial campaign's "Start your free trial" → `/en/us/fragments/start-trial`) open in a bottom sheet, the way the website opens fragment links in a modal. The sheet doesn't rebuild the form: it shows the site's own `booking` block (fragment `/en/us/fragments/booking-experience`, the same one the booking page uses) through [aem-embed](https://www.aem.live/docs/aem-embed), so steps, options, validation and consent text are authored in DA and styled by the site. Prefill values (`location`, `experience`) are passed to the block through the embed host's `data-query`.

`book.html` hosts the embed in its own frame so the block lays out for the sheet's width. Append `?site=<origin>` to the app URL to embed from another environment (for example a branch preview or a local `aem up` on `http://localhost:3000`).

The app reads `.plain.html` (pages and fragments without site chrome) and JSON sheets, then maps EDS blocks (`hero`, `campaign`, `cards`, `events`, `stats`, `offer-summary`, `faq`…) to native-style components. Turn on **X-ray** on desktop to see which block or sheet each component came from.

The site sends `Access-Control-Allow-Origin: *`, so the app calls EDS directly from the browser.

Known gap: sheet image paths like `/media/com-sun.jpg` are redirects that resolve only on `.aem.page` today, so those images load from preview.

## Authoring the app (no deploy needed)

The app's structure is a sheet in DA: [`/en/us/data/app.json`](https://da.live/sheet#/kunwarsaluja/frescopa/en/us/data/app). Edit it, then Preview and Publish; the app picks it up on the next load or **Sync now**. Sheet tabs must be named `shared-…` for EDS to publish them.

| Tab | Columns | What it controls |
|---|---|---|
| `shared-screens` | screen, type, title, subtitle, source, item link | What each screen shows. `type` is one of `home`, `offers`, `products`, `locations`, `page`. `source` is the sheet, index or page it reads. `subtitle` can use `{n}` (item count). `item link` can use row fields, e.g. `/en/us/booking?location={id}` |
| `shared-tabs` | label, screen, icon | Bottom tabs, in order |
| `shared-actions` | label, link, icon | Home quick actions. `link` is a screen id or any site path or fragment |
| `shared-links` | link, opens | Site paths the app opens differently, e.g. `/en/us/booking` → `/en/us/fragments/booking-experience` |
| `shared-labels` | key, text | UI text: `featured`, `greeting-morning`, `greeting-afternoon`, `greeting-evening`, `loading`, `synced`, `back`, `close` |

Icons: `home`, `tag`, `bag`, `person`, `pin`, `calendar`, `chat`, `star`, `gift`.

Examples of authoring changes: point Help at another page, add a "Book a visit" quick action (`link`: `/en/us/booking`), rename a tab, reorder tabs, show a new page as a screen. A new screen **type** (a new layout) is the only thing that needs a code change.

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
