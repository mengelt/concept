# STRATA

A proof-of-concept UI for triaging vulnerability remediation work at scale. STRATA reframes a backlog of hundreds of thousands of individual findings into a small set of actionable **campaigns** (verb/noun pairs like *Patch Log4j Library* or *Upgrade PostgreSQL*) so security and platform teams can plan, scope, and dispatch work in human-meaningful units.

See `STRATA.md` for a full feature catalog.

## Setup

Requires Node.js 18+ and npm.

```bash
npm install
npm run dev
```

The dev server opens at `http://localhost:5173` automatically.

## Build

```bash
npm run build
npm run preview
```

The static build lives in `dist/`.

## Quick configuration

Open `src/App.jsx` and look near the top for the `CONFIG` block:

```js
const BRAND = {
  name: 'STRATA',
  tagline: 'Vulnerability Operations',
  footerNote: 'proof-of-concept',
};

const ORG = {
  emailDomain: 'mycompany.com',
  internalDomain: 'internal',
};
```

Change `BRAND.name` to rebrand the entire UI. Change `ORG.emailDomain` and every synthesized email updates. Change `ORG.internalDomain` and hostnames, runbook URLs, monitoring URLs, and repo URLs all flow through one knob.

The `THEMES` registry just below it is a copy-paste-and-tweak shop. Add an entry, get a new theme everywhere — the picker UI auto-discovers it.

## Project layout

```
strata/
├── index.html              Vite entry
├── package.json
├── vite.config.js
├── README.md               this file
├── STRATA.md               feature catalog
└── src/
    ├── main.jsx            React entry point
    └── App.jsx             entire app (~2,160 lines)
```

The whole app is a single file. Sections are clearly delineated with banner comments so you can navigate by jumping to `// ─── CONFIG`, `// ─── THEMES`, etc.

## Stack

- React 18
- Vite
- Recharts (only the Treemap)
- Lucide icons

No router, no state library, no CSS framework. Routing is `window.location.hash`. Theming is CSS variables applied at runtime. Estimates / filters live in component state.

## Status

This is a mockup. Data is synthetic — 257K findings across 5,000 fictional assets, deterministic by seed. See the "Caveats & things deliberately not built" section in `STRATA.md` for the honest list of what's stubbed.
"# concept" 
