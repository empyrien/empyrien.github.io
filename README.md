# empyrien.com

Static site — no framework, no build step.

## Structure

- `index.html` — landing
- `vision/` — hub linking to section pages
- `vision/{faith,prophecy,pattern,trilemma,numbers,suddenly}/` — sections
- `vision/style.css` — shared stylesheet
- `feast/` — Bahá'í Nineteen Day Feast programmes (see below)

## Feast programmes

`feast/index.html` lists the programmes; each programme is a folder such as
`feast/kalimat/`. Three shared files do all the work:

- `feast/style.css` — theming via `data-theme` / `data-contrast` / `data-face` /
  `data-lead` on `<html>`, plus a `--scale` custom property for text size
- `feast/feast.js` — display preferences, reader assignment, pronunciation
  margin notes, the slideshow, and the generated ambient tone
- `feast/glossary.js` — pronunciation entries, keyed by the exact word as it
  appears in the text

### Adding a programme

Copy `feast/kalimat/index.html`, then:

1. Set `<body data-program="…">` to a unique id — reader names and assignments
   are stored per programme in `localStorage` under that id.
2. Give each `<article class="reading">` a unique `data-key` (used for
   assignments) and a `data-label` (shown in the slideshow, e.g.
   "Reading 3 of 9").
3. Quote passages verbatim and link each one to its paragraph on
   `bahai.org/library/…` using the `#`-anchor of that paragraph.
4. Regenerate the QR code for the new URL and paste the SVG into `.qr-frame`.

Nothing needs a build step, and the readings live in the HTML rather than in
JavaScript, so a programme still reads and prints with scripting turned off.

### Regenerating a QR code

```
pip install segno
python3 tools/make-qr.py https://empyrien.com/feast/<slug>/
```

### Editing the date

Each programme has a single `<p class="dateline">` in the masthead, marked with
a comment. Feast dates move a little year to year — check the current list at
<https://www.bahai.org/action/devotional-life/calendar>.

## Deploying to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`empyrien/empyrien.github.io`).
2. Framework preset: **Other**. Leave Build Command and Output Directory empty (static site served from repo root). `vercel.json` is already configured.
3. Deploy, then add `empyrien.com` under Project → Settings → Domains and follow Vercel's DNS instructions at your registrar (Hover).
4. Once the domain is verified on Vercel, remove the GitHub Pages custom domain (repo Settings → Pages) to avoid conflicts. The `CNAME` file only affects GitHub Pages and is ignored by Vercel.
