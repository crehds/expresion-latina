# Expresión Latina

Mobile-first web app for a dance academy: visitors check the week's class
schedule, browse dance genres and teachers, and find the studio.

## Stack

- React 18.2, class components in pages, function components in leaves
- react-router-dom 6, routes lazy-loaded in `src/App.js`
- Create React App (`react-scripts` 5.0.1)
- Plain CSS, one file per component under a local `css/` folder; shared
  tokens in `src/styles/`
- Deployed to GitHub Pages via `gh-pages`

## Setup

```bash
npm ci
npm run dev
```

Verified on Node 24.21.0 and npm 11. `react-scripts` 5.0.1 predates Node 18,
so if a future Node release breaks the build, that is the signal to migrate to
Vite rather than to patch around it.

## Scripts

| Script           | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `npm run dev`    | Dev server on http://localhost:3000                      |
| `npm run build`  | Production bundle into `build/`                          |
| `npm test`       | Test runner in watch mode                                |
| `npm run deploy` | Builds, then publishes `build/` to the `gh-pages` branch |

## Deploying

Deploy from `main`, after merging the work you want released:

```bash
git checkout main
npm run deploy
```

Live at <https://crehds.github.io/expresion-latina>.

Three pieces have to agree for a GitHub Pages project site to work. Changing
one without the others produces a blank page, so they are listed together:

1. **`homepage` in `package.json`** — makes the build emit
   `/expresion-latina/static/...` instead of `/static/...`. Without it every
   asset 404s.
2. **`basename` on `BrowserRouter`** (`src/index.js`) — reads `PUBLIC_URL` so
   in-app navigation resolves against the same prefix.
3. **`public/404.html`** — GitHub Pages does no server-side rewriting, so a
   direct request to `/schedules` would hit its 404 page. The shim encodes the
   path into a query string and `public/index.html` restores it before React
   Router mounts.

If the repository is ever renamed, update `homepage` to match.

### Post-deploy checklist

Unit tests cannot catch path-prefix bugs, so check by hand after a deploy:

- [ ] <https://crehds.github.io/expresion-latina> loads with styles and images
- [ ] Open `/expresion-latina/schedules` **directly** in the address bar, not
      via in-app navigation — this is what the 404 shim exists for
- [ ] Reload while on a sub-route
- [ ] Repeat on a real phone, not just device emulation

## Line endings

`.gitattributes` pins `eol=lf` for all text files. `eslint-config-airbnb`
enforces `linebreak-style: unix` and CRA fails the production build on eslint
errors, so a Windows checkout with `core.autocrlf=true` would otherwise break
`npm run build` on every source file.

If you have an existing clone with CRLF files:

```bash
git rm --cached -r .
git reset --hard
```
