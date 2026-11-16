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

**Site experiences through [aem-embed](https://www.aem.live/docs/aem-embed).** Where the site already designs the experience, the app shows it with `<aem-embed>` and the site's own blocks render it.

| Where | Embedded |
|---|---|
| Home | the announcement and featured campaign fragments chosen in the app document |
| Book a visit, a House, the trial campaign button | the booking fragments, in a bottom sheet |
| Events, Help, any other site page the app links to | the page itself |

Links inside embedded content are handled by the app: fragments open in the bottom sheet, site pages open in the app, other sites open in the browser.

## Authoring the app

Authors run the app from one document in DA: [`/en/us/app/experience`](https://da.live/form#/kunwarsaluja/frescopa/en/us/app/experience). It's [structured content](https://www.aem.live/docs/ew/administering/structured-content) with the schema `frescopa-app`, and the app reads it as JSON:

- live: `https://da-sc.adobeaem.workers.dev/live/kunwarsaluja/frescopa/en/us/app/experience`
- preview: the same URL with `preview`, used when the app is opened with `?preview`

Edit it in **Frescopa Studio**, a DA app in the site repo: `https://da.live/app/kunwarsaluja/frescopa/tools/frescopa-studio/frescopa-studio#/en/us/app/experience`. Studio shows the form next to the app on a phone, which updates as you type; it finds the app through the `previews` sheet of the DA site config (`…/app/?{tier}`). Changes save to DA as you type. Preview updates the app's preview mode; Publish updates the live app on its next start. DA's own form editor opens the same document.

| Field | Controls |
|---|---|
| Announcement | Path of an announcement fragment shown at the top of Home, e.g. `/en/us/fragments/announcements/member-week` (a `campaign` block works well). Empty hides it |
| Featured campaign | Path of the campaign fragment shown on Home |
| Quick actions, Bottom tabs | Label, icon and what it opens: an app screen (`home`, `offers`, `shop`, `houses`) or a site page path |
| Offers, Shop, Houses screen | Title and subtitle (`{n}` is the number of items) |
| Open in a bottom sheet | Links to a page that open a fragment over the app instead, e.g. `/en/us/booking` → `/en/us/fragments/booking-experience` |
| App text | Greetings, labels and messages |

Icons: `home`, `tag`, `bag`, `person`, `pin`, `calendar`, `clock`, `chat`. A new kind of screen (a new layout) or icon is the only change that needs code.

## Code

No build step, no runtime dependencies.

```
index.html, demo.*   demo page: the app in a phone frame + content request list
app/
  index.html         the app
  app.js             app document, tabs, navigation, link handling, drafts from Studio
  eds.js             everything that talks to AEM: the app document, JSON, aem-embed
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
