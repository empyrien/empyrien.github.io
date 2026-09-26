# empyrien.com

Static site — no framework, no build step. Pushing to `main` deploys (Vercel).

## Structure

- `index.html` — landing: the dawn hero, then one arched door per area
- `journey/` — the guided introduction; the story is the `N` object in the page
- `vision/` — contents page; chapters in `vision/{faith,prophecy,pattern,trilemma,numbers,suddenly}/`
- `letters/` — Twenty-Seven Letters, the Vision's interlude
- `feast/` — Feast programmes. **Not linked from the rest of the site** (reached
  by URL or QR code) and styled on its own; see below
- `404.html`, `robots.txt`, `sitemap.xml` (the sitemap leaves out `/feast`)
- `assets/` — the shared design system, share cards (`assets/og/`)
- `tools/` — generators for the star geometry, icons, share cards and QR codes

## Design system

Every page outside `/feast` uses `assets/site.css` and `assets/site.js`.

- **Type:** Cormorant Garamond (display), Literata (text), Source Code Pro
  (labels). All three contain every transliteration glyph the site uses
  (á í ú ḍ ḥ ṣ ẓ ʻ ʼ). Many fonts silently lack ḥ and ṣ (Newsreader, JetBrains
  Mono, DM Mono…), so check coverage before swapping any of them.
- **Colour:** tokens at the top of `site.css`. Night, parchment ink, and gold
  as the only light; starlight and ember are the only other accents.
  `--ink-4` is for decoration only — it fails contrast as text.
- **The star:** every nine-pointed star (brand mark, favicon, astrolabe,
  ornaments) is drawn from `tools/star.py`.
- **Articles** are a grid: text runs in a reading column; add `.wide` to let a
  figure, the arches or the timeline step out into a broader one.
- **No script needed:** every page reads with JavaScript off. `[data-reveal]`
  content is hidden only after `site.js` has run (see the inline script in
  each `<head>`), and reduced motion switches every animation off.

### Adding an area

Copy one `<a class="doorway">` in `index.html` and draw its window: an SVG
clipped to the arch path, 200×280. The row of doors re-centres for any count.
Then add the area to the top bar, the mobile menu and the footer on every page.

### Adding a Vision chapter

Copy a chapter page and keep its parts: the numeral head, the article, and the
next-chapter door at the end. Then update the contents list in `vision/`, the
previous chapter's next door, `sitemap.xml`, and give it a share card.

### Share cards and icons

```
node tools/og/render.mjs [name …]   # assets/og/*.png from tools/og/card.html
python3 tools/make-icons.py         # favicon.ico, favicon-32.png, apple-touch-icon.png
```

The card renderer needs Node 22+ and Google Chrome; add new pages to `CARDS`
in `render.mjs`. The icon script needs Pillow. `favicon.svg` is edited by hand.

## Feast programmes

`feast/index.html` lists the programmes; each programme is a folder such as
`feast/kalimat/`. Three shared files do all the work:

- `feast/style.css` — theming via `data-theme` / `data-contrast` / `data-face` /
  `data-lead` on `<html>`, plus a `--scale` custom property for text size
- `feast/feast.js` — display preferences, reader assignment, pronunciation
  margin notes, the slideshow, and the generated ambient tone
- `feast/glossary.js` — pronunciation entries, keyed by the exact word as it
  appears in the text
- `feast/qr.js` — a small byte-mode QR encoder, so the code on the page can be
  redrawn in the browser to carry the current reader assignments

### Sharing reader assignments

There is no server, so assignments travel in the link rather than being stored
anywhere: `?f=` is the roster (names, `~`-separated, percent-encoded) and `?s=`
is one base-36 character per reading in page order giving that reader's index,
or `-` for unassigned. Opening such a link imports the list into that device's
`localStorage` and then cleans the query string off the address bar.

The QR code on the programme page is regenerated from that link whenever the
assignments change, so scanning it hands over the programme *and* the list.
Rosters too large to encode (past ~250 characters) fall back to the static
plain-URL code and the Copy link button.

`feast/qr.js` is generated, not hand-written:

```
pip install segno opencv-python-headless numpy
python3 tools/gen-qr-js.py > feast/qr.js
python3 tools/verify-qr.py
```

`gen-qr-js.py` emits the spec tables straight out of `segno` so none of them
are transcribed by hand. `verify-qr.py` renders the encoder's output and
decodes it with OpenCV, checking the text survives the round trip and that the
symbol is never larger than the one segno picks for the same input. Note that
exact matrix equality with segno is *not* the test: in byte mode segno always
appends one extra `0x00` pad codeword, so the two produce different but equally
valid symbols.

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

## Deploying

Push to `main`; Vercel deploys in a few seconds. The Vercel team blocks
deployments whose commit author isn't a team member, so set this repo's
`git config user.email` to the Empyrien address before committing.
