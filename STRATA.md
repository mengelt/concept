# STRATA — Vulnerability Operations UI

A proof-of-concept interface for triaging and dispatching vulnerability remediation work at scale. STRATA reframes a backlog of hundreds of thousands of individual findings into a small set of actionable **campaigns** — verb/noun pairs like *Patch Log4j Library* or *Upgrade PostgreSQL* — so a security or platform team can plan, scope, dispatch, and track work in human-meaningful units instead of wading through individual CVEs.

This document describes what the mockup does today.

---

## Concepts

### Campaign (verb/noun bucket)
The primary unit of work. Every finding rolls up into exactly one campaign defined by a remediation **verb** (*Patch*, *Upgrade*, *Rotate*, *Configure*, *Replace*, *Disable*, *Enable*, *Decommission*) and a **noun** (the affected component, e.g. *Apache HTTP Server*, *SSH Keys*, *MFA on Admin Consoles*). The mockup ships with 25 campaigns covering ~257K synthetic findings.

### Asset
A discrete piece of infrastructure: server, database, application, or container. The mockup synthesizes a registry of 5,000 assets, each carrying environment, criticality tier, owning team, and a full metadata bundle. The same asset can appear in multiple campaigns — a single Ubuntu host might need both a kernel patch and an OpenSSL upgrade — which makes cross-campaign work-bundling possible.

### Person / assignee
A fake employee in the roster. 22 people across 10 teams, each with a name, role, team, deterministic avatar color, and id. Campaigns can be assigned to one or more people; assignment state lives at the App level so the avatar overlay on the treemap and the assignment strip on the bucket detail stay in sync.

### Effort multipliers
A finding's true cost depends on *what* it touches, *where* it lives, and *how important* it is. STRATA models this with three multipliers applied to a baseline hours-per-fix estimate:

| Dimension | Values |
| --- | --- |
| Asset class | server ×1.0 · database ×1.45 · application ×1.10 · container ×0.65 |
| Environment | Production ×1.5 · Staging ×1.0 · Development ×0.7 |
| Criticality tier | Crown Jewel (T1) ×1.6 · Important (T2) ×1.2 · Standard (T3) ×0.85 |

A T1 production database fix costs ~3.5× a T3 dev container fix of the same baseline — a roughly 9× spread across the population, which matches operational reality. Every `×N` value in the UI has a hover tooltip explaining what it means and why.

### SLA Policy
Findings have a per-severity time-to-remediate target:

| Severity | SLA | Approaching threshold |
| --- | --- | --- |
| Critical | 3 days | n/a (too short) |
| High | 90 days | 72 days |
| Medium | 180 days | 144 days |
| Low | 360 days | 288 days |

Each finding carries an age in days; status is derived as *OK*, *Approaching*, or *Overdue*. Aggregates roll up to the campaign and asset levels.

---

## Pages

### Operations Brief (overview)

The landing surface, designed to answer "where do I focus today?" in a single screen.

- **Global search.** A live search input in the header spans the entire app. Searches across asset IDs, hostnames, IPs, team names, and campaign names; results appear in a dropdown grouped by kind (Campaigns / Assets) with prefix matches sorted ahead of substring matches. Click or Enter to navigate (Arrow keys move highlight, Esc dismisses). Capped at 12 results so the dropdown stays scannable. Index is precomputed once across all 5K assets + 25 campaigns so typing stays snappy.
- **Assessment Source filter.** A pill row at the top scopes everything below it — treemap, lens cards, totals, and every drill-down — to findings from a single scanner: Continuous Scan (Rapid7/Tenable-style), Coverity (SAST), Configuration Audit (CIS hardening), Cloud Posture (CSPM), Penetration Test, or Dependency Scan. "All sources" is the default. Each pill shows the running finding count for that source. The filter is encoded as `?assessment=…` in the URL so it's bookmarkable and survives refresh; it propagates through every drill-down (campaign, asset, findings) where it's shown as a small "Filtered: X ✕" chip on the breadcrumb that the user can clear in one click.
- **Headline band.** Total findings, total affected assets, total estimated effort, and total SLA overdue — alongside an inline 90-day burndown sparkline showing trajectory. Reflects the active assessment filter.
- **Four lens cards** for the top campaigns through different prioritization framings:
  - **Leverage Plays** — highest findings closed per engineer-hour. *One action, many fixes.*
  - **Risk Crushers** — highest severity-weighted risk score per hour (critical ×10, high ×7.5, medium ×5, low ×2 then divided by effort hours). *Highest danger per hour.*
  - **Policy Alignment** — campaigns with the most SLA overdue findings, weighted by severity. *Most past SLA.*
  - **Quick Wins** — smallest end-to-end effort. *Smallest end-to-end.*
- **Only my campaigns toggle.** A checkbox row directly above the Effort Map filters the treemap to campaigns the current user is assigned to. The current user is identified by `CURRENT_USER_ID` (defaults to `jane.doe`) and appears next to the checkbox as an avatar with name so it's clear who "you" are. Shows a running count: "5 of 25" when filtering, "25 total" otherwise. Persisted in URL as `?mine=1` so it composes with the assessment filter and survives refresh. Lens cards and the summary band stay org-wide (navigational context); only the effort map narrows to your queue.
- **"Only my campaigns" toggle.** A checkbox above the Effort Map filters the treemap to campaigns the current user (`CURRENT_USER_ID`, defaults to `jane.doe`) is assigned to. Shows a count like "4 of 25" next to the checkbox so it's clear what was filtered out. The summary band and lens cards stay org-wide on purpose — they're navigational context, not "my work." Persisted as `?mine=1` in the URL. Composes with the assessment filter: hidden buckets stay hidden in both modes.
- **Effort Map (treemap).** All 25 campaigns sized by total effort hours, color-coded by dominant severity. The left strip on each cell encodes severity explicitly. Cells with assignees show a small avatar stack in the top-right corner; unassigned cells get a subtle dim strip along the bottom edge so "what isn't being worked" is scannable at a glance. Click a cell to drill in. Empty state appears when filters combine to hide every campaign, with a hint about which filter to clear.

### Cockpit (overview alternate)

A sibling page to Operations Brief, reachable via the **Ops Brief / Cockpit** segmented control in the header. Where the Brief asks *"where do I focus today?"*, the Cockpit asks *"what happened in this window?"* — it's the retrospective surface for understanding throughput.

- **Range picker.** Preset pills for *7 days*, *30 days*, *90 days*, *6 months*, and *YTD*, plus a *Custom* button that reveals inline `from → to` date inputs. The active preset is highlighted; choosing a custom range that doesn't match any preset auto-reveals the date fields. Range is encoded in the URL as `?from=YYYY-MM-DD&to=YYYY-MM-DD` and is bookmarkable; default is the last 30 days. Composes with the global Sources filter — when sources are filtered, all flow numbers scale proportionally (same `globalScale` approach the burndown uses).
- **Four headline tiles** — each carries a prior-period delta (same range length, immediately preceding the current window) color-coded green/red by whether the change is favorable:
  - **Discovered.** New findings in the window. Lower is better.
  - **Remediated.** Findings closed in the window. Higher is better.
  - **Net flow.** *Discovered − Remediated*. Negative ≈ backlog shrinking (good), positive ≈ growing (bad); the tile color tracks the sign.
  - **CAP Extensions.** Count of Corrective Action Plan extensions in the window, plus how many distinct campaigns they spanned.
- **Discovery vs. Remediation chart.** A dual-line area chart over the range — red for discovered, green for remediated. Inline SVG, responsive to container width, hover anywhere to reveal a vertical tracker plus the day's exact values. Legend and live readout sit below the chart.
- **Aging histogram.** Stacked-bar chart of *open* findings binned by age in days: *0–30, 30–60, 60–90, 90–120, 120–150, 150–180, 180+*. Each bar is segmented by severity (Critical on top, Low on bottom) so stale-and-dangerous stands out. Totals appear above each bar with percent-of-population below. This is a snapshot — it does **not** recompute when the range picker moves, because the question is "what does the open queue look like *right now?*". The bin proportions are derived analytically from `generateAge`'s piecewise probabilities (sampled 5K times per severity at module load) and then applied to each campaign's `sevCounts`.
- **CAP activity.** A three-tile row (Created / Extended / Closed counts in range), followed by a two-column section: top 5 campaigns ranked by extensions in range, and a recent-activity feed (last 8 events, newest first).

URL example: `#/cockpit?from=2026-02-10&to=2026-05-11&assessment=continuous` — three months of continuous-scan activity. Range params are silently dropped when navigating away from the cockpit so they don't dirty up unrelated URLs.

### Campaign Detail (bucket)

What it would take to fully close a single campaign across all affected assets.

- **Hero stats:** finding count, estimated effort, severity-weighted risk score.
- **Assignment strip:** avatar stack of currently-assigned people with a quick list of the first three names/roles, plus an "Assign people" button (or "Manage assignees" if the list is non-empty). Empty state reads *"Unassigned — nobody is currently working this campaign."*
- **SLA strip:** overdue count, approaching count, per-severity overdue badges, and a 90-day burndown sparkline for this campaign.
- **Four-column breakdown:** by severity, by asset class (with multipliers), by criticality tier, by environment. Multiplier values have hover tooltips explaining why they're what they are.
- **Inline baseline editor:** edit the per-fix hours for this campaign right on the page; the campaign total updates live, with a one-click reset to the default baseline.
- **Affected Assets table:** each row shows asset id (with ⓘ for metadata modal), class, environment, tier badge, finding count, oldest finding age in days, SLA badge (Overdue / Approaching / em-dash for on-track), and latest CVE. Filterable by asset class, environment, criticality tier, and team. Sortable by severity, finding count, criticality, environment, or oldest first. Empty-state message with a "Reset filters" button when filters combine to zero rows. Click a row to drill into the asset.

### Asset Detail (third level)

What it would cost to fully clean up a single asset across every campaign that touches it. This is the planning surface for change windows.

- **Hero:** asset id (with copy button) plus context line (class · env · team), criticality badge, the combined multiplier breakdown with hover tooltips, and a "View metadata" button.
- **Hero stats:** total findings on this asset, estimated effort to fully clean it, critical-finding count.
- **SLA strip:** overdue status with oldest open age, an escalation note that varies by tier (T1 escalates to P1 on-call within 24 hours), and a per-asset 90-day burndown sparkline.
- **"While you're touching this asset" callout** with a *Plan change window* CTA — the design's argument for *bundling* every campaign that affects a host into one maintenance window instead of N separate touches.
- **Campaigns table:** every campaign that affects this asset, sorted by severity then hours. Each row links back to the campaign detail; the per-row **Findings** button drills directly into this asset's findings *within that campaign*. Bottom totals row sums hours and findings across all campaigns.

### Findings (fourth level)

The individual finding-level view — the surface analysts spend most of their day on. Reachable two ways: the **View findings** button on a campaign detail (campaign-wide), or the per-row **Findings** button on the asset detail's campaigns table (scoped to that asset × campaign).

- **Hero stats:** total findings, critical+high count, SLA overdue count, KEV count.
- **Action bar:** live "N selected" counter and **Add to CAP** / **Add to Existing CAP** buttons (placeholder — no functionality wired). Buttons are disabled when no findings are selected. A `clear` link appears once selection is non-zero. The bar background subtly shifts when selection is active.
- **Filter row:** by severity, SLA state (overdue / approaching / on-track), KEV (yes / no / any), POC (yes / no / any), workflow status. Sort by Priority Score (default), severity, KEV-first, oldest, or first-found date.
- **Findings table** with these columns:
  - **Checkbox** (header acts as select-all-visible with tri-state for partial selection).
  - **Severity** dot.
  - **Finding ID** — short stable id like `F-PATC-1042-001`.
  - **CVE** — per-finding (multiple CVEs can come from the same campaign on the same asset).
  - **Asset** — only shown when the view is campaign-wide; clicking the asset id navigates to the asset detail, and the ⓘ icon opens the metadata modal.
  - **KEV** — Yes/No pill (red "Yes", quiet "no") indicating CISA Known Exploited Vulnerability.
  - **POC** — Yes/No pill (amber "Yes", quiet "no") indicating a public proof-of-concept exists. KEV implies POC.
  - **Priority Score** — 0–4000, color-graded (red ≥ 3000, orange ≥ 2000, accent ≥ 1000, dim below). Computed deterministically from severity base + KEV bonus + POC bonus, scaled by asset criticality and environment, plus mild noise.
  - **First Found** — ISO date (today minus age).
  - **Age** — days since first found, red if past SLA.
  - **SLA** badge (Overdue / Approaching / em-dash for on-track).
  - **Source** — color-coded assessment-type tag (Continuous, Coverity, Config, CSPM, Pentest, Deps). Hidden when the global assessment filter is locked to a single type, since every visible row would have the same value.
  - **Status** — workflow tag (Open / In Progress / Risk Accepted / Fixed / False Positive).
- **Empty state** with a *Reset filters* button when filters yield zero rows.
- **Render cap:** 800 rows visible with a "+N more" footer, same pattern as the asset table.
- **Global assessment filter** is honored at the per-finding level — each finding has a stable `assessment` derived from its campaign's mix, and rows of any non-matching type drop out before the table renders.

### Asset Metadata Modal

A click-anywhere popup with everything needed to file a ticket, page someone, or open a runbook. Triggered by the ⓘ icons next to asset ids in the campaign asset list, or by the "View metadata" button on the asset detail page.

- **90-day burndown sparkline** for this asset.
- **Contact:** primary owner (mailto link), secondary owner, Slack channel, PagerDuty rotation. All copyable.
- **Infrastructure:** hostname, IP address (10.x for prod, 172.x for staging, 192.x for dev), region/AZ, CMDB ID, deployed-at, last-modified. Copyable.
- **Tags:** synthesized realistically — `tier-1`, `pci-scope`, `data-store`, `public-facing`, `soc2-scope`, `regulated`.
- **Quick links:** Runbook, Monitoring, Repo (open in new tab).
- Dismissable with Escape key, click-outside, or close button.

### People Picker Modal

A multi-select picker for assigning people to a campaign. Triggered by the "Assign people" / "Manage assignees" button on the campaign detail.

- **Search field** that matches name, role, team, or id (autofocused on open).
- **Team filter dropdown** alongside the search — quick way to scope to one team.
- **Live "selected" summary** showing how many people are picked plus an inline avatar stack of who they are.
- **Selectable rows** showing avatar, name, role, team. Selected rows get a soft accent background and an accent-colored checkbox. Click to toggle.
- **Footer actions:** Clear all, Cancel, Apply.
- Empty state when filters yield no people. Escape key, click-outside, or close button all dismiss.

### Estimates Panel (slide-over)

Top-right cog opens a 540px slide-over for tuning per-campaign baseline hours.

- **Live total** and **Δ from current** at the top — every keystroke recalculates.
- One row per campaign with its current value, override indicator (overridden values turn accent-colored with a reset arrow), and a live preview of the resulting effort.
- Reset-all, Cancel, and Apply buttons.
- An explainer paragraph documenting the multiplier model.

---

## Cross-cutting features

### Global search
A persistent search input lives in the top header and is available from every page. The index is built once over the world: every campaign (by verb + noun) and every asset (by id, hostname, IP, team, criticality, environment) — ~5,025 entries total. Typing 2+ characters surfaces a dropdown of up to 12 results with prefix matches sorted before substring matches and campaigns ranked above assets at equal relevance. Asset rows show their hostname/IP/team/tier as a sub-line; campaign rows show finding count and affected asset count. Arrow keys navigate; Enter picks the highlighted result; Esc closes; clicking outside dismisses. Pressing **/** anywhere on the page focuses the search field (suppressed when typing in other inputs). A small `/` hint inside the field advertises the shortcut.

Picking an asset jumps to that asset's detail page using the first campaign that affects it as the breadcrumb anchor; picking a campaign jumps to its detail page. Both navigations preserve any active assessment filter.

### Theme system
Three themes ship: **Light** (warm cream / amber accent — default), **Dark** (warm dark / amber accent), **Midnight** (cool navy / teal accent). Themes live in a single `THEMES` registry where each theme owns a complete set of CSS variables, applied at runtime via `document.documentElement.style.setProperty`. Adding a new theme is copy-paste-and-tweak — the picker UI auto-discovers it. The picker is a small dropdown in the header that shows each theme as a name plus a four-cell color swatch preview, with a check mark on the current one. Theme selection persists across reloads via the URL.

### URL routing
Hash-based routing so any view is bookmarkable and shareable:

```
#/                                              overview
#/cockpit                                       cockpit (defaults to last 30 days)
#/cockpit?from=2026-02-10&to=2026-05-11         cockpit with explicit range
#/c/patch-log4j                                 campaign detail
#/c/patch-log4j/a/srv-prd-1042                  asset detail
#/c/patch-log4j/findings                        all findings in a campaign
#/c/patch-log4j/a/srv-prd-1042/findings         findings on one asset within a campaign
#/?theme=midnight                               any of the above + theme override
#/?assessment=coverity                          any of the above + assessment-source filter
#/?mine=1                                       overview filtered to "my" campaigns
#/c/upgrade-java?assessment=coverity            filters propagate through every drill-down
```

Browser back/forward work. Clicking the STRATA logo always returns home. Invalid bucket routes redirect to overview. A bucket route that exists but is hidden by the active assessment filter renders an explicit "no findings of this type" placeholder with a *Clear filter* button — the user keeps their place and can recover with one click.

### Avatars
Circular MUI-style component that falls back to colored initials. Each person has a deterministic color drawn from a 15-color palette via id hash, so the same person always gets the same avatar color. `AvatarStack` overlaps multiple avatars and adds a `+N` overflow chip when the list exceeds `max`. Avatars carry tooltips with name, role, and team on hover.

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
- **22** people in the roster across 10 teams.
- Findings are not allocated as raw objects — only aggregations. Per-campaign breakdowns and per-asset entries are pre-computed at startup. This is how a real product would shape its API too; sending 250K rows to the browser is not a thing.
- The **Findings view** (fourth level) materializes individual finding records on demand from the aggregate `(asset, bucket)` entry — pulling out severity and age from the existing arrays, then synthesizing per-finding CVE, KEV/POC flags, Priority Score (0–4000), First Found date, and workflow status. Deterministic by `(bucketId, assetId)` seed, so the same asset under the same campaign always shows the same findings. Capped at 800 visible rows per scope.

### Distributions
- Asset types in the org follow a 50/10/30/10 split (server/db/app/container).
- Environments: 45% prod, 30% staging, 25% dev.
- Criticality is environment-correlated — prod skews T1/T2, dev mostly T3.
- Severity mixes are bucket-specific (Log4j skews critical; TLS configuration skews medium/low).
- Finding ages skew younger for criticals (more attention) and older for lows. ~13% of findings are out of policy in aggregate, with a heavier overdue concentration in older medium findings.
- 8 campaigns ship pre-assigned out of the box so the avatar overlay is visible without any setup.

### Effort calculation
A campaign's effort = sum over (asset type, environment) of:

```
affected_assets × env_share × baseline_hours × asset_mult × env_mult × avg_crit_mult_for_env
```

Importantly, hours scale **per affected asset**, not per finding. Patching Log4j on a host fixes all that host's Log4j CVEs in one action. Each campaign carries a `findingsPerAsset` factor (Log4j ~7, Ubuntu OS ~12, single-fix items like Replace Certs = 1) so the model reflects how remediation actually works.

### Burndown timeseries
90 days of mock data per scope (global / per campaign / per asset). Generated with an ease-in-out decline curve (faster early, asymptotic toward the floor) plus a weekly sinusoidal cycle and ~2% noise. Deterministic by seed, so the same asset always shows the same trend.

### Cockpit data synthesis
The Cockpit needs two things the base data model doesn't carry: a daily *discovery* and *remediation* flow, and a CAP event log. Both are synthesized deterministically at module load.

- **Discovery / remediation flow.** 365 days of daily `{ discovered, remediated }` counts at the org-wide level, generated from the total finding count with a weekly cycle (discovery skews Mon/Tue, remediation Tue–Thu, weekend dip on both), occasional discovery spikes (~5% of days, a scanner burst), occasional remediation pushes (~7% of days, a patch sprint), and light noise. Tuned so cumulative remediation slightly outpaces cumulative discovery, matching the burndown narrative. The Cockpit slices into this array by date range and scales by `globalScale` when an assessment source is filtered.
- **CAP log.** Each campaign gets 1–5 CAPs proportional to its affected-asset count. Each CAP has a creation date (30–365 days ago), 0–3 extensions sprinkled along its lifetime (each adding 7–67 days), and a 50% chance of being closed. All events carry a `daysAgo` field so the cockpit's range filter is a single inequality check.

### Assessment sources
Six scanner types model the heterogeneous reality of where findings come from: **Continuous Scan** (Rapid7/Tenable-style network/host scanning), **Coverity** (SAST), **Configuration Audit** (CIS hardening / compliance), **Cloud Posture** (CSPM), **Penetration Test** (manual red-team), and **Dependency Scan** (SCA / supply chain). Each campaign carries a hand-authored `assessmentMix` — a probability distribution that sums to 1.0 — capturing the realistic blend of sources for that work. Log4j leans continuous + dependency; runtime upgrades (Java/Node/Python) carry meaningful Coverity share because SAST often catches related code-level bugs alongside the runtime CVE; TLS, MFA, and rotation campaigns lean config audit + pentest; cloud-adjacent campaigns (k8s, certs, TLS) pick up CSPM share. Per-finding assessment type is then drawn deterministically from this mix at materialization time, so any individual finding always reports the same source.

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

The `PEOPLE` constant is the roster. Add or remove employees and the picker, treemap overlay, and assignment strips all update — `PEOPLE_BY_ID` is built from it on the fly.

SLA policy lives in the `SLA_DAYS` constant. The criticality tier definitions live in `CRITICALITY`. Asset class multipliers and environment multipliers are top-level constants. All easy to tune in one place.

---

## Caveats & things deliberately not built

These are mockup gaps that would need real work for a production system:

- **Asset list virtualization.** Currently capped at 150 rows with a "+N more" footer. A real implementation needs `@tanstack/react-virtual` or equivalent. The Findings view has a similar 800-row cap.
- **Campaign workflow state.** Campaigns are either *exists* or *doesn't*. No Planned / In Progress / Blocked / Done machinery at the campaign level yet. (Per-finding workflow status — Open / In Progress / Risk Accepted / Fixed / False Positive — is shown on the Findings view but is synthesized, not editable.)
- **Risk-accept / exception flow.** No way to mark a finding as accepted-with-justification. The status is read-only.
- **Cross-campaign bundling planner.** The asset detail page hints at it ("plan change window") but there's no flow for selecting N assets and dispatching a bundled work order.
- **Corrective Action Plans (CAPs).** The Findings view has multi-select and "Add to CAP" / "Add to Existing CAP" buttons, but they're visual affordances only — there's no CAP CRUD UI behind them. The Cockpit has a synthesized CAP event log (created / extended / closed events per campaign) just rich enough to drive the *Extensions in range* metric and a small activity feed; it isn't editable.
- **Cockpit remediation events.** The Cockpit's *Discovered* and *Remediated* tiles count synthetic daily events from a generated flow timeseries, not real per-finding state transitions. A real system would derive these from the audit trail on each finding's status changes.
- **Per-asset assignment.** Assignment is at the campaign level, not the asset level. Right granularity for now (the operational unit *is* the campaign) but if "Jane handles the prod databases, Marcus handles the apps" within a single campaign matters, that's a follow-up.
- **Workload view across people.** "Show me everyone's queue, sorted by total hours." Genuinely useful but a new page.
- **Assignment persistence.** Assignments live in component state and don't survive a page reload. Would need localStorage or a real backend.
- **Estimate ranges.** Point estimates only. The schema is flexible enough to support typical/min/max but the UI doesn't surface them.
- **Filter / sort state in URL.** The assessment-source filter is in the URL. Other page-level filters (severity, SLA, KEV/POC, status) are not — they reset on navigation. Easy to extend if it matters.
- **Effort scaling under the assessment filter.** When the user filters to e.g. Coverity, displayed effort hours scale proportionally to that source's share of each campaign. Strictly speaking, the underlying remediation action is the same regardless of which scanner saw the symptoms — patching Log4j is the same patch whether it came from continuous scan or dependency scan — so the "true" effort wouldn't change. Proportional scaling is used because users expect the headline number to move with the filter; revisit if the team wants stricter semantics.
- **Global search.** No CVE → campaign or asset id → metadata jump.
- **Trend over time per dimension.** Only finding *count* burns down. Effort, overdue count, etc. don't have time series yet.
- **Auth / RBAC / "my view".** Single-user mockup. No notion of "show me my team's queue by default."
- **The "Plan change window" button** on asset detail is a visual affordance only — no scheduling backend.

---

## File layout

The entire app is a single `App.jsx` file (~5,100 lines) organized top-to-bottom as:

1. Imports
2. **CONFIG** — `BRAND`, `ORG` constants
3. **THEMES** registry + `applyThemeVars`, `cellPalette` helpers
4. Seeded RNG and distribution helpers
5. SLA policy + `slaStatus`, `generateAge`, `generateBurndown`
6. **COCKPIT data synthesis** — `computeAgingHistogram`, `generateFlow`, `buildCapLog` and supporting aging-bin proportions
7. **ASSESSMENT_TYPES** registry + per-bucket `ASSESSMENT_MIX_BY_BUCKET` + `bucketShare` helper
8. Bucket definitions and aggregation builders
9. Asset world builder (registry + reverse index + metadata + burndowns)
10. **PEOPLE** roster + makePerson helper
11. `materializeFindings` — expands an `(asset, bucket)` aggregate entry into individual finding records (id, CVE, KEV, POC, Priority Score, First Found, workflow status, assessment source)
12. Format helpers
13. Hash routing (`parseHash`, `serializeHash`, `useRoute`) — including cockpit view + `from`/`to` range params
14. Global styles (CSS variables, fonts, scrollbar, animations)
15. Small components (`SeverityBar`, `StatNum`, `SevDot`, `CritBadge`, `Sparkline`, `SlaBadge`, `Avatar`, `AvatarStack`, `PeoplePickerModal`, `CopyButton`, `FilterSelect`, `AssessmentFilter`, `AssessmentChip`, `AssessmentTag`, `FilteredEmptyState`, `MyCampaignsToggle`, `GlobalSearch`, `ThemePicker`, `AssetMetaModal`, `YesNoBadge`, `StatusTag`, `ViewToggle`)
16. Big components (`Header`, `SummaryBand`, `LensCard`, `LensesRow`, `TreemapCell`, `CampaignTreemap`, `BreakdownRow`, `BucketDetail`, `AssetDetail`, `FindingsView`, `EstimatesPanel`, `CockpitView` + `RangePicker` / `CockpitTile` / `FlowChart` / `AgingHistogram` / `CapActivityStrip`, `Footer`)
17. `App` (default export) — routing wire-up, assignment state, `displayBuckets` / `displayHoursMap` / `displayWorld` memos that scale aggregates by the active assessment filter, `globalScale` memo shared by cockpit, modal mounts

Imports: React, Recharts (only the Treemap), Lucide icons. No other third-party dependencies.
