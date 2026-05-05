# STRATA — Vulnerability Operations UI

A proof-of-concept interface for triaging and dispatching vulnerability remediation work at scale. STRATA reframes a backlog of hundreds of thousands of individual findings into a small set of actionable **campaigns** — verb/noun pairs like *Patch Log4j Library* or *Upgrade PostgreSQL* — so a security or platform team can plan, scope, and dispatch work in human-meaningful units instead of wading through individual CVEs.

This document describes what the mockup does today.

---

## Concepts

### Campaign (verb/noun bucket)
The primary unit of work. Every finding rolls up into exactly one campaign defined by a remediation **verb** (*Patch*, *Upgrade*, *Rotate*, *Configure*, *Replace*, *Disable*, *Enable*, *Decommission*) and a **noun** (the affected component, e.g. *Apache HTTP Server*, *SSH Keys*, *MFA on Admin Consoles*). The mockup ships with 25 campaigns covering ~257K synthetic findings.

### Asset
A discrete piece of infrastructure: server, database, application, or container. The mockup synthesizes a registry of 5,000 assets, each carrying environment, criticality tier, owning team, and a full metadata bundle. The same asset can appear in multiple campaigns — a single Ubuntu host might need both a kernel patch and an OpenSSL upgrade — which makes cross-campaign work-bundling possible.

### Effort multipliers
A finding's true cost depends on *what* it touches, *where* it lives, and *how important* it is. STRATA models this with three multipliers applied to a baseline hours-per-fix estimate:

| Dimension | Values |
| --- | --- |
| Asset class | server ×1.0 · database ×1.45 · application ×1.10 · container ×0.65 |
| Environment | Production ×1.5 · Staging ×1.0 · Development ×0.7 |
| Criticality tier | Crown Jewel (T1) ×1.6 · Important (T2) ×1.2 · Standard (T3) ×0.85 |

A T1 production database fix costs ~3.5× a T3 dev container fix of the same baseline — a roughly 9× spread across the population, which matches operational reality. The dotted-underline tooltips on every multiplier in the UI explain why each value is what it is.

### SLA Policy
Findings have a per-severity time-to-remediate target:

| Severity | SLA | Approaching threshold |
| --- | --- | --- |
| Critical | 3 days | n/a (too short) |
| High | 90 days | 72 days |
| Medium | 180 days | 144 days |
| Low | 360 days | 288 days |

Each finding carries an age in days; status is derived as *OK*, *Approaching*, or *Breached*. Aggregates roll up to the campaign and asset levels.

---

## Pages

### Operations Brief (overview)

The landing surface, designed to answer "where do I focus today?" in a single screen.

- **Headline band.** Total findings, total affected assets, total estimated effort, and total SLA breaches — alongside an inline 90-day burndown sparkline showing trajectory.
- **Four lens cards** for the top campaigns through different prioritization framings:
  - **Leverage Plays** — highest findings closed per hour. *One action, many fixes.*
  - **Risk Crushers** — highest severity-weighted risk score per hour. *Highest danger per hour.*
  - **Policy Alignment** — campaigns with the most SLA breaches, weighted by severity. *Most past SLA.*
  - **Quick Wins** — smallest end-to-end effort. *Smallest end-to-end.*
- **Effort Map (treemap).** All 25 campaigns sized by total effort hours, color-coded by dominant severity. The left strip on each cell encodes severity explicitly. Click a cell to drill in.

### Campaign Detail (bucket)

What it would take to fully close a single campaign across all affected assets.

- **Hero stats:** finding count, estimated effort, severity-weighted risk score.
- **SLA strip:** breached count, approaching count, per-severity breach badges, and a 90-day burndown sparkline for this campaign.
- **Four-column breakdown:** by severity, by asset class (with multipliers), by criticality tier, by environment. Multiplier values have hover tooltips explaining why they're what they are.
- **Inline baseline editor:** edit the per-fix hours for this campaign right on the page; the campaign total updates live, with a one-click reset to the default baseline.
- **Affected Assets table:** each row shows asset id (with ⓘ for metadata, copy is in the modal), class, environment, tier badge, finding count, oldest finding age in days, SLA badge (Breached / Approaching), and latest CVE. Filterable by asset class, environment, criticality tier, and team. Sortable by severity, finding count, criticality, environment, or oldest first. Empty-state message with a "Reset filters" button when filters combine to zero rows. Click a row to drill into the asset.

### Asset Detail (third level)

What it would cost to fully clean up a single asset across every campaign that touches it. This is the planning surface for change windows.

- **Hero:** asset id (with copy button) plus context line (class · env · team), criticality badge, the combined multiplier breakdown with hover tooltips, and a "View metadata" button.
- **Hero stats:** total findings on this asset, estimated effort to fully clean it, critical-finding count.
- **SLA strip:** breach status with oldest open age, an escalation note that varies by tier (T1 escalates to P1 on-call within 24 hours), and a per-asset 90-day burndown sparkline.
- **"While you're touching this asset" callout** with a *Plan change window* CTA — the design's argument for *bundling* every campaign that affects a host into one maintenance window instead of N separate touches.
- **Campaigns table:** every campaign that affects this asset, sorted by severity then hours. Each row links back to the campaign detail. Bottom totals row sums hours and findings across all campaigns.

### Asset Metadata Modal

A click-anywhere popup with everything needed to file a ticket, page someone, or open a runbook. Triggered by the ⓘ icons next to asset ids in the campaign asset list, or by the "View metadata" button on the asset detail page.

- **90-day burndown sparkline** for this asset.
- **Contact:** primary owner (mailto link), secondary owner, Slack channel, PagerDuty rotation. All copyable.
- **Infrastructure:** hostname, IP address (10.x for prod, 172.x for staging, 192.x for dev), region/AZ, CMDB ID, deployed-at, last-modified. Copyable.
- **Tags:** synthesized realistically — `tier-1`, `pci-scope`, `data-store`, `public-facing`, `soc2-scope`, `regulated`.
- **Quick links:** Runbook, Monitoring, Repo (open in new tab).
- Dismissable with Escape key, click-outside, or close button.

### Estimates Panel (slide-over)

Top-right cog opens a 540px slide-over for tuning per-campaign baseline hours.

- **Live total** and **Δ from current** at the top — every keystroke recalculates.
- One row per campaign with its current value, override indicator (overridden values turn accent-colored with a reset arrow), and a live preview of the resulting effort.
- Reset-all, Cancel, and Apply buttons.
- An explainer paragraph documenting the multiplier model.

---

## Cross-cutting features

### Theme system
Three themes ship: **Light** (warm cream / amber accent — default), **Dark** (warm dark / amber accent), **Midnight** (cool navy / teal accent). Themes live in a single `THEMES` registry where each theme owns a complete set of CSS variables, applied at runtime via `document.documentElement.style.setProperty`. Adding a new theme is copy-paste-and-tweak — the picker UI auto-discovers it. The picker is a small dropdown in the header that shows each theme as a name plus a four-cell color swatch preview, with a check mark on the current one. Theme selection persists across reloads via the URL.

### URL routing
Hash-based routing so any view is bookmarkable and shareable:

```
#/                                       overview
#/c/patch-log4j                          campaign detail
#/c/patch-log4j/a/srv-prd-1042           asset detail
#/?theme=midnight                        any of the above + theme override
```

Browser back/forward work. Clicking the STRATA logo always returns home. Invalid bucket routes redirect to overview.

### Click-to-copy
High-frequency identifiers (asset ids, hostnames, IPs, CMDB ids, owner emails, Slack channels, on-call rotations) all carry a copy icon that flips to a green checkmark for ~1 second after copy. `event.stopPropagation` prevents parent row clicks. Designed for the analyst workflow of pasting these into tickets and runbooks all day.

### Multiplier tooltips
Every `×N` value in the UI has a plain-language explanation on hover (e.g. *"Database (×1.45): replication checks, coordination, and rollback rigor add ~45%."*). Visually marked with a faint dotted underline and `cursor: help`.

### Empty states
Filter combinations that yield zero rows show a helpful message and a single-click *"Reset filters"* button instead of a blank table.

---

## Data model & realism

### Counts
- **257K** synthetic findings across 25 campaigns.
- **5,000** assets in the registry.
- Findings are not allocated as raw objects — only aggregations. Per-campaign breakdowns and per-asset entries are pre-computed at startup. This is how a real product would shape its API too; sending 250K rows to the browser is not a thing.

### Distributions
- Asset types in the org follow a 50/10/30/10 split (server/db/app/container).
- Environments: 45% prod, 30% staging, 25% dev.
- Criticality is environment-correlated — prod skews T1/T2, dev mostly T3.
- Severity mixes are bucket-specific (Log4j skews critical; TLS configuration skews medium/low).
- Finding ages skew younger for criticals (more attention) and older for lows. ~13% of findings are out of policy in aggregate, with a heavier breach concentration in older medium findings.

### Effort calculation
A campaign's effort = sum over (asset type, environment) of:

```
affected_assets × env_share × baseline_hours × asset_mult × env_mult × avg_crit_mult_for_env
```

Importantly, hours scale **per affected asset**, not per finding. Patching Log4j on a host fixes all that host's Log4j CVEs in one action. Each campaign carries a `findingsPerAsset` factor (Log4j ~7, Ubuntu OS ~12, single-fix items like Replace Certs = 1) so the model reflects how remediation actually works.

### Burndown timeseries
90 days of mock data per scope (global / per campaign / per asset). Generated with an ease-in-out decline curve (faster early, asymptotic toward the floor) plus a weekly sinusoidal cycle and ~2% noise. Deterministic by seed, so the same asset always shows the same trend.

---

## Configuration

A `CONFIG` block at the top of the file holds quickly-tweakable constants:

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

The `THEMES` registry is similarly self-contained — add an entry, get a new theme everywhere.

SLA policy lives in the `SLA_DAYS` constant. The criticality tier definitions live in `CRITICALITY`. Asset class multipliers and environment multipliers are top-level constants. All easy to tune in one place.

---

## Caveats & things deliberately not built

These are mockup gaps that would need real work for a production system:

- **Asset list virtualization.** Currently capped at 150 rows with a "+N more" footer. A real implementation needs `@tanstack/react-virtual` or equivalent.
- **Workflow state.** Campaigns are either *exists* or *doesn't*. No Planned / In Progress / Blocked / Done / Risk Accepted machinery yet.
- **Risk-accept / exception flow.** No way to mark a finding as accepted-with-justification.
- **Cross-campaign bundling planner.** The asset detail page hints at it ("plan change window") but there's no flow for selecting N assets and dispatching a bundled work order.
- **Estimate ranges.** Point estimates only. The schema is flexible enough to support typical/min/max but the UI doesn't surface them.
- **Filter / sort state in URL.** Page-level routes are in the URL; filter state is not. Filters reset on navigation.
- **Source attribution.** No way to see "which scanner found this finding." Same CVE often comes from three sources.
- **Global search.** No CVE → campaign or asset id → metadata jump.
- **Trend over time per dimension.** Only finding *count* burns down. Effort, breach count, etc. don't have time series yet.
- **Auth / RBAC / "my view".** Single-user mockup. No notion of "show me my team's queue by default."
- **The "Plan change window" button** on asset detail is a visual affordance only — no scheduling backend.
- **Real ad-hoc filters in the estimate panel.** You see all campaigns; can't bulk-edit by verb or noun pattern.

---

## File layout

The entire app is a single `strata.jsx` file (~2,160 lines) organized top-to-bottom as:

1. Imports
2. **CONFIG** — `BRAND`, `ORG` constants
3. **THEMES** registry + `applyThemeVars`, `cellPalette` helpers
4. Seeded RNG and distribution helpers
5. SLA policy + `slaStatus`, `generateAge`, `generateBurndown`
6. Bucket definitions and aggregation builders
7. Asset world builder (registry + reverse index + metadata + burndowns)
8. Format helpers
9. Hash routing (`parseHash`, `serializeHash`, `useRoute`)
10. Global styles (CSS variables, fonts, scrollbar, animations)
11. Small components (`SeverityBar`, `StatNum`, `SevDot`, `CritBadge`, `Sparkline`, `SlaBadge`, `CopyButton`, `FilterSelect`, `ThemePicker`, `AssetMetaModal`)
12. Big components (`Header`, `SummaryBand`, `LensCard`, `LensesRow`, `TreemapCell`, `CampaignTreemap`, `BreakdownRow`, `BucketDetail`, `AssetDetail`, `EstimatesPanel`, `Footer`)
13. `App` (default export) — routing wire-up

Imports: React, Recharts (only the Treemap), Lucide icons. No other third-party dependencies.
