# empyrien.com

Static site — no framework, no build step.

## Structure

- `index.html` — landing
- `vision/` — hub linking to section pages
- `vision/{faith,prophecy,pattern,trilemma,numbers,suddenly}/` — sections
- `vision/style.css` — shared stylesheet

## Deploying to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`empyrien/empyrien.github.io`).
2. Framework preset: **Other**. Leave Build Command and Output Directory empty (static site served from repo root). `vercel.json` is already configured.
3. Deploy, then add `empyrien.com` under Project → Settings → Domains and follow Vercel's DNS instructions at your registrar (Hover).
4. Once the domain is verified on Vercel, remove the GitHub Pages custom domain (repo Settings → Pages) to avoid conflicts. The `CNAME` file only affects GitHub Pages and is ignored by Vercel.
