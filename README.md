# Expresión Latina

Mobile-first web app for a dance academy: visitors check the week's class
schedule, browse dance genres and teachers, and find the studio.

## Stack

- React 18.2, class components in pages, function components in leaves
- react-router-dom 6, routes lazy-loaded in `src/App.js`
- Create React App (`react-scripts` 5.0.1)
- Plain CSS, one file per component under a local `css/` folder; shared
  tokens in `src/styles/`
- Deployed on Vercel, which builds and publishes on every push

## Setup

```bash
npm ci
npm run dev
```

Verified on Node 24.21.0 and npm 11. `react-scripts` 5.0.1 predates Node 18,
so if a future Node release breaks the build, that is the signal to migrate to
Vite rather than to patch around it.

## Scripts

| Script          | What it does                        |
| --------------- | ----------------------------------- |
| `npm run dev`   | Dev server on http://localhost:3000 |
| `npm run build` | Production bundle into `build/`     |
| `npm test`      | Test runner in watch mode           |

## Home page posters

The carousel on the home page renders the images bundled in
`src/assets/images/posters/`. That is the default and needs no backend.

It previously fetched them from an upload API backed by MongoDB Atlas. That
service no longer exists — its host returns `Application not found` — so the
carousel rendered nothing, silently, because the fetch had no error handling.

To point the carousel at a replacement API, create `.env.local` (gitignored)
with:

```
REACT_APP_POSTERS_API_URL=https://your-api.example.com
```

The app then requests `GET {REACT_APP_POSTERS_API_URL}/posters` and expects
`{ "data": [ { "_id": ..., "originalname": ..., "publicUrl": ... } ] }`, where
`publicUrl` is either a URL string or a `{ "value": "<url>" }` wrapper. If the
request fails, times out, or returns no usable records, the bundled posters
stay on screen.

Leave the variable empty and no request is made at all.

> Create React App only exposes variables prefixed with `REACT_APP_`, and it
> inlines them into the bundle at build time. They are public once deployed,
> so never put a secret there.

To change the bundled posters, replace the files in
`src/assets/images/posters/` and update the list in
`src/pages/Home/api/fallbackPosters.js`.

## Deploying

Vercel builds and publishes on every push. There is no deploy script to run.

The site is served from the **root** of its domain, so the build must emit
root-relative asset paths. That happens by default: `package.json` deliberately
carries no `homepage` field, and nothing sets `PUBLIC_URL`.

Do not add either without changing the host to match. A base path the host does
not serve from produces a blank page with no useful error: the browser requests
`/some-prefix/static/js/main.js`, the host has no such file, its SPA fallback
answers with `index.html`, and the browser reports

```
Uncaught SyntaxError: Unexpected token '<'
```

because it is parsing HTML as JavaScript. `manifest.json` fails the same way.
That is the signature of a base-path mismatch, not of a broken bundle.

Client-side routes work because Vercel rewrites unmatched paths to
`index.html`. Deep links need no shim of their own.

### Node version

The build needs Node 24, set in the Vercel project settings; older defaults
fail. `react-scripts` 5.0.1 is from December 2021, so if a future Node release
breaks the build, that is the signal to migrate to Vite rather than patch
around it.

### Post-deploy checklist

Unit tests cannot catch a base-path mismatch, so check by hand after a deploy:

- [ ] The site loads with styles and images, and the console is clean
- [ ] Open `/schedules` **directly** in the address bar, not via in-app
      navigation
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
