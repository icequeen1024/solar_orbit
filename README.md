# Solar Orbit

A two-dimensional planetary proximity atlas for the Sun and eight planets. Move
through time from January 1, 2000 to January 1, 4000, select a planet, and see
which other planet is nearest at that instant and over the full analysis range.

## Features

- Heliocentric Keplerian positions based on NASA/JPL approximate elements.
- Physical nearest-neighbor calculations independent from display compression.
- True relative body diameters under one shared visual scale.
- Forward and reverse playback, five speed presets, custom multipliers, and UTC
  date jumping.
- Six-hour nearest-planet analysis with transition refinement to one simulated
  minute.
- Keyboard-accessible planet selection and controls.
- Device-local persistence for the selected planet, date, speed, and camera.

## Local development

Requires Node.js 24 and npm 11.

```sh
npm install
npm run dev
```

The project-site development URL is `http://localhost:5173/solar_orbit/`.

## Verification

```sh
npm test
npm run build
```

Rebuild the committed nearest-planet statistics with:

```sh
npm run generate:statistics
```

Use `node --experimental-strip-types scripts/generate-nearest.ts --converge` to
also compare the six-hour results against a three-hour analysis.

## GitHub Pages

Pushing to `main` runs `.github/workflows/deploy-pages.yml`, which tests and
builds the static Vite application before publishing `dist` to GitHub Pages.
In the repository settings, Pages must use **GitHub Actions** as its source.

The configured project URL is:

<https://icequeen1024.github.io/solar_orbit/>

## Scientific limitation

The NASA/JPL element fit used by this project is valid through 3000 CE. Solar
Orbit extrapolates its secular rates from 3000 to 4000 CE, and the interface
discloses that later positions are illustrative rather than observatory-grade.

See [SPEC.md](./SPEC.md) for the full product and scientific specification.
