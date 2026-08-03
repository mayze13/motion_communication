# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Communication and recruitment materials for the "Minds in Motion" UCL neuroarchitecture
study (September 2026). Plain static HTML/CSS/JS — no build tool, no package manager,
no test suite. Every file is edited directly and previewed by opening it in a browser
(or a VS Code Live Server, useful when testing the signup form's network call).

## Commands

There are none — no `package.json`, no build/lint/test scripts. "Running" this project
means opening the relevant HTML file in a browser.

## Architecture

```
Participant → flyer QR code or emailed link
            → index.html  (repo root, static host: Netlify/Vercel/GitHub Pages)
            → fills signup form → fetch() POST → Power Automate HTTP trigger
            → Power Automate checks for duplicate email, then appends a row
              to an Excel table hosted on SharePoint (UCL servers)
            → JSON response → website shows thank-you (or "already signed up") state
```

### The backend has moved — trust the code, not `README.md`

`README.md` and `apps-script/Code.gs` describe the **original** backend
(Google Apps Script → Google Sheets) and reference a `website/index.html` path.
Neither is current:

- The live signup form is repo-root **`index.html`**, not `website/index.html`.
- `index.html` posts to a `POWER_AUTOMATE_URL` constant (around line 732), a live,
  signed Power Automate HTTP-trigger endpoint — treat it as a secret; don't echo it
  into logs or otherwise re-expose it beyond what's already committed.
- The actual current backend is documented in `microsoft/powerautomate-setup.md`:
  Power Automate → duplicate-email check → append row to an Excel table on
  SharePoint. `apps-script/Code.gs` is legacy/unwired; don't assume it's live
  without checking `index.html`'s fetch target first.

If asked to change how signups are recorded, confirm which backend (Power
Automate/SharePoint, current; or Apps Script/Sheets, legacy) is actually meant to
change before editing either.

### File map

- `index.html` — the live participant signup site: markup, CSS, and the `fetch()`
  POST logic all inline in one file. Primary target for changes to form fields,
  copy, or the submission endpoint.
- `flyer/flyer.html` — print-ready A5 flyer. The QR code is generated client-side
  from a `text:` URL in a `<script>` block; the adjacent `<p class="short-link">`
  element must be kept in sync with it manually. Print via Chrome/Firefox at A5,
  no/minimum margins, background graphics enabled. `flyer/flyer.pdf` is a checked-in
  export, not auto-generated — regenerate and re-commit it whenever `flyer.html`
  changes.
- `email/outreach-template.html` — HTML email template with bracketed placeholders
  (`[WEBSITE_URL]`, `[study email address]`, `[ethics reference]`,
  `[study image URL]`, `[UCL logo URL]`, `[unsubscribe URL]`) filled in per-campaign
  before sending via Mailchimp or similar. Image/logo references must be publicly
  hosted URLs — email clients can't load files from this repo.
- `apps-script/Code.gs` — legacy Google Sheets backend (see above); contains its own
  inline setup instructions written for non-developers.
- `microsoft/powerautomate-setup.md` — current backend setup instructions. The HTTP
  trigger requires a premium Power Automate connector; most UCL M365 accounts have
  it, but flag the licensing requirement if a user hits a wall. Also documents two
  extra Power Automate flows ("Export New Signups" / "Mark Batch as Mailed") that
  stamp `Exported Date` / `Mailed Date` columns on the Signups table, so repeat
  outreach exports only ever pick up people who haven't been exported/mailed yet.
  The actual mass email send stays external (Mailchimp/Gmail), using
  `email/outreach-template.html` as the campaign body.
- `assets/` — logos, hero images/SVGs, QR code SVG, team headshots under
  `assets/images/people/`. `assets/README.txt` documents the expected filenames and
  provenance — check it before adding/replacing branding assets. Missing a headshot
  file falls back to showing the person's initials on the site.

### Branding

UCL Purple `#361a54`, UCL White `#fafafa`. Font: DM Sans (Google Fonts) for the
website and flyer; Arial/Helvetica for the email template (email clients don't
reliably support web fonts). Match new UI to these rather than introducing new
colors/fonts.

### Placeholders are intentional

Bracketed placeholder text (`[...]`) in the email template and setup docs is meant
to be filled in per-campaign by whoever runs outreach — don't "fix" it by inventing
values.
