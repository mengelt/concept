import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Settings, X, ChevronRight, Zap, Target, ShieldAlert,
  ArrowLeft, Server, Database, Globe, Box, RotateCcw, Layers,
  Sun, Moon, Crown, Star, Circle, User, Link2,
  Wrench, Calendar, AlertCircle, Clock, TrendingDown, Info,
  Mail, Hash, MapPin, Tag as TagIcon, ExternalLink, Phone,
  Palette, Check, Copy, Users, UserPlus, Search,
  List, ListChecks, Plus, FilePlus,
  Activity, Bug, ClipboardCheck, Cloud, Crosshair, Package, Filter
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RNG
// ─────────────────────────────────────────────────────────────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pickFromMix(mix, r) {
  let acc = 0;
  for (let i = 0; i < mix.length; i++) {
    acc += mix[i];
    if (r < acc) return i;
  }
  return mix.length - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SEV = ['Critical', 'High', 'Medium', 'Low'];
const SEV_COLOR = ['var(--sev-critical)', 'var(--sev-high)', 'var(--sev-medium)', 'var(--sev-low)'];

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG  ─  quick-tweak constants. Edit these to rebrand the mockup.
// ─────────────────────────────────────────────────────────────────────────────
const BRAND = {
  name: 'STRATA',
  tagline: 'Vulnerability Operations',
  footerNote: 'proof-of-concept',
};

const ORG = {
  emailDomain: 'mycompany.com',  // used wherever a user email is shown
  internalDomain: 'internal',     // used for runbook.<x>, grafana.<x>, git.<x>, hostnames
};

// The "you" of the demo — used by the "Only my campaigns" filter on the
// overview. Must match an `id` in the PEOPLE roster below. To make the demo
// feel like someone else, change this to e.g. 'sam.okafor' or 'priya.patel'.
const CURRENT_USER_ID = 'jane.doe';

// Global scale applied to every campaign's finding count. The hand-authored
// numbers in BUCKETS_DEF were originally calibrated to ~256k total to mimic
// a large-scale enterprise scanner inventory; for demos this number was
// overwhelming and not useful, so we scale down to ~25k while keeping the
// per-asset finding density (findingsPerAsset) unchanged. That means a
// campaign that originally affected 6,000 assets with 30k findings now
// affects 600 assets with 3k findings — same "many fixes per action" story,
// at a digestible scale.
const FINDINGS_SCALE = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// THEMES  ─  registry. To add a theme: copy a block, rename the key, tweak the
// hex values. Everything in `vars` becomes a CSS custom property on :root, and
// the `cellPalette` helper derives the small set of colors needed for SVG fills.
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    label: 'Light',
    vars: {
      '--bg':            '#faf7ef',
      '--surface':       '#ffffff',
      '--surface-2':     '#f3eee2',
      '--surface-3':     '#e7e0cc',
      '--border':        '#ddd5bf',
      '--border-bright': '#a89f86',
      '--text':          '#1a1612',
      '--text-dim':      '#5b554a',
      '--text-faint':    '#8a8273',
      '--accent':        '#b54a14',
      '--accent-2':      '#7a3008',
      '--accent-soft':   '#f1d9c4',
      '--sev-critical':  '#dc2626',
      '--sev-high':      '#ea580c',
      '--sev-medium':    '#ca8a04',
      '--sev-low':       '#64748b',
      '--crit-t1':       '#dc2626',
      '--crit-t2':       '#b54a14',
      '--crit-t3':       '#64748b',
      '--good':          '#1f7a3e',
      '--wash-opacity':  '0.14',
      '--grain-opacity': '0.5',
    },
  },
  dark: {
    label: 'Dark',
    vars: {
      '--bg':            '#0b0b0d',
      '--surface':       '#131418',
      '--surface-2':     '#1f2228',
      '--surface-3':     '#2a2e36',
      '--border':        '#2a2e36',
      '--border-bright': '#4a4f58',
      '--text':          '#f0ebe0',
      '--text-dim':      '#a8aab0',
      '--text-faint':    '#6a6d74',
      '--accent':        '#f0b264',
      '--accent-2':      '#b07d3a',
      '--accent-soft':   '#2a2118',
      '--sev-critical':  '#ff5757',
      '--sev-high':      '#ff8a3d',
      '--sev-medium':    '#e6b133',
      '--sev-low':       '#7a8290',
      '--crit-t1':       '#ff5757',
      '--crit-t2':       '#f0b264',
      '--crit-t3':       '#7a8290',
      '--good':          '#7dd3a0',
      '--wash-opacity':  '0.08',
      '--grain-opacity': '0.4',
    },
  },
  midnight: {
    label: 'Midnight',
    vars: {
      '--bg':            '#0a1124',
      '--surface':       '#131c33',
      '--surface-2':     '#1c2640',
      '--surface-3':     '#2a3656',
      '--border':        '#2a3656',
      '--border-bright': '#42526d',
      '--text':          '#e6ebf5',
      '--text-dim':      '#94a3c0',
      '--text-faint':    '#5e6e8a',
      '--accent':        '#5eead4',
      '--accent-2':      '#0d9488',
      '--accent-soft':   '#0d2c2c',
      '--sev-critical':  '#f87171',
      '--sev-high':      '#fb923c',
      '--sev-medium':    '#fbbf24',
      '--sev-low':       '#94a3b8',
      '--crit-t1':       '#f87171',
      '--crit-t2':       '#5eead4',
      '--crit-t3':       '#94a3b8',
      '--good':          '#86efac',
      '--wash-opacity':  '0.10',
      '--grain-opacity': '0.3',
    },
  },
};

const THEME_KEYS = Object.keys(THEMES);
const DEFAULT_THEME = 'light';

// Apply theme variables to <html> element.
function applyThemeVars(themeKey) {
  if (typeof document === 'undefined') return;
  const t = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// Pick out the small set of colors used directly in SVG fills (treemap cells).
function cellPalette(themeKey) {
  const v = (THEMES[themeKey] || THEMES[DEFAULT_THEME]).vars;
  return {
    bg:           v['--bg'],
    surface2:     v['--surface-2'],
    text:         v['--text'],
    textDim:      v['--text-dim'],
    accent:       v['--accent'],
    sev: [v['--sev-critical'], v['--sev-high'], v['--sev-medium'], v['--sev-low']],
    washOpacity:  parseFloat(v['--wash-opacity']),
  };
}

const CRITICALITY = {
  T1: { label: 'Crown Jewel',     short: 'T1', multiplier: 1.6,  color: 'var(--crit-t1)', icon: Crown },
  T2: { label: 'Important',        short: 'T2', multiplier: 1.2,  color: 'var(--crit-t2)', icon: Star },
  T3: { label: 'Standard',         short: 'T3', multiplier: 0.85, color: 'var(--crit-t3)', icon: Circle },
};
const CRIT_KEYS = ['T1', 'T2', 'T3'];

// criticality distribution by environment (more prod assets are mission-critical)
const CRIT_MIX_BY_ENV = {
  Production:  [0.30, 0.45, 0.25],
  Staging:     [0.08, 0.35, 0.57],
  Development: [0.02, 0.18, 0.80],
};
function avgCritMult(env) {
  const m = CRIT_MIX_BY_ENV[env];
  return m[0] * CRITICALITY.T1.multiplier + m[1] * CRITICALITY.T2.multiplier + m[2] * CRITICALITY.T3.multiplier;
}

const ASSET_TYPES = {
  server:    { label: 'Server',      Icon: Server,   multiplier: 1.0,  prefix: 'srv' },
  database:  { label: 'Database',    Icon: Database, multiplier: 1.45, prefix: 'db'  },
  app:       { label: 'Application', Icon: Globe,    multiplier: 1.10, prefix: 'app' },
  container: { label: 'Container',   Icon: Box,      multiplier: 0.65, prefix: 'ctr' },
};
const ASSET_TYPE_KEYS = ['server', 'database', 'app', 'container'];

const ENV_MULT = { Production: 1.5, Staging: 1.0, Development: 0.7 };
const ENV_MIX = [['Production', 0.45], ['Staging', 0.30], ['Development', 0.25]];

// ─────────────────────────────────────────────────────────────────────────────
// SLA POLICY  —  per-severity, in days
// ─────────────────────────────────────────────────────────────────────────────
const SLA_DAYS = [3, 90, 180, 360]; // critical / high / medium / low
const APPROACHING_THRESHOLD = 0.8;  // within 80% of SLA = "approaching"

function slaStatus(sevIdx, ageDays) {
  const limit = SLA_DAYS[sevIdx];
  if (ageDays > limit) return 'overdue';
  if (ageDays > limit * APPROACHING_THRESHOLD) return 'approaching';
  return 'ok';
}

// per-finding age generator — deterministic via passed rng
// distribution skew: criticals get fixed faster, lows linger
function generateAge(sevIdx, rng) {
  const r = rng();
  if (sevIdx === 0) {
    // critical, SLA 3d
    if (r < 0.70) return Math.floor(rng() * 3);              // in SLA
    if (r < 0.92) return 3 + Math.floor(rng() * 12);         // 3-14d overdue
    if (r < 0.99) return 15 + Math.floor(rng() * 45);        // 15-59d
    return 60 + Math.floor(rng() * 90);                       // 60+d very bad
  }
  if (sevIdx === 1) {
    // high, SLA 90d
    if (r < 0.72) return Math.floor(rng() * 70);             // safely in SLA
    if (r < 0.85) return 70 + Math.floor(rng() * 22);        // approaching
    if (r < 0.96) return 92 + Math.floor(rng() * 60);        // 92-151d overdue
    return 152 + Math.floor(rng() * 200);
  }
  if (sevIdx === 2) {
    // medium, SLA 180d
    if (r < 0.78) return Math.floor(rng() * 140);
    if (r < 0.90) return 140 + Math.floor(rng() * 50);
    if (r < 0.98) return 190 + Math.floor(rng() * 100);
    return 290 + Math.floor(rng() * 200);
  }
  // low, SLA 360d
  if (r < 0.85) return Math.floor(rng() * 280);
  if (r < 0.95) return 280 + Math.floor(rng() * 100);
  return 380 + Math.floor(rng() * 300);
}

// estimated bucket-level overdue counts using the same generator distribution
const OVERDUE_RATE      = [0.30, 0.28, 0.22, 0.15];  // ~ probability a finding is past SLA
const APPROACHING_RATE = [0.00, 0.13, 0.12, 0.10];  // critical SLA is so short there's no "approaching"

// ─────────────────────────────────────────────────────────────────────────────
// BURNDOWN TIMESERIES  —  90-day declining trend with weekly cycle + noise
// ─────────────────────────────────────────────────────────────────────────────
function generateBurndown(currentCount, days, seed) {
  const rng = makeRng(seed);
  const startMult = 1.30 + rng() * 0.20; // started 30-50% higher
  const startCount = Math.round(currentCount * startMult);
  const out = [];
  for (let i = 0; i < days; i++) {
    const t = i / Math.max(1, days - 1);
    // ease-in-out: faster decline early, slows toward the floor
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const base = startCount - (startCount - currentCount) * eased;
    const weekly = Math.sin(i * Math.PI / 3.5) * currentCount * 0.012;
    const noise = (rng() - 0.5) * currentCount * 0.018;
    out.push(Math.max(Math.round(currentCount * 0.92), Math.round(base + weekly + noise)));
  }
  out[out.length - 1] = currentCount;
  return out;
}

// Verb-noun campaign definitions. Columns:
// [id, verb, noun, baseHours, count, sevMix C/H/M/L, assetMix s/db/a/ctr, findingsPerAsset]
// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT TYPES — the source/scanner each finding came from
// ─────────────────────────────────────────────────────────────────────────────
// Each campaign has a mix of assessment types — most campaigns lean toward one
// dominant scanner but often have a secondary source (e.g. Log4j shows up in
// continuous scans AND dependency/SCA scans; TLS issues show up in config
// audits AND cloud posture). The mix sums to 1.0 per campaign.
const ASSESSMENT_TYPES = {
  continuous: { label: 'Continuous Scan',     short: 'Continuous', color: '#3b8c5b', icon: Activity,        desc: 'Network/host vulnerability scanning (Rapid7, Tenable, Qualys)' },
  coverity:   { label: 'Coverity (Static)',   short: 'Coverity',   color: '#8a4a98', icon: Bug,             desc: 'Static application security testing — code-level bugs' },
  config:     { label: 'Configuration Audit', short: 'Config',     color: '#a36b1d', icon: ClipboardCheck,  desc: 'Hardening / CIS benchmark compliance checks' },
  cloud:      { label: 'Prisma Cloud',        short: 'Prisma',     color: '#2f6f9e', icon: Cloud,           desc: 'Cloud posture & misconfiguration (Prisma Cloud)' },
  pentest:    { label: 'Penetration Test',    short: 'Pentest',    color: '#a83253', icon: Crosshair,       desc: 'Manual red-team / penetration test findings' },
  dependency: { label: 'Dependency Scan',     short: 'Deps',       color: '#356d6b', icon: Package,         desc: 'SCA — third-party library / supply-chain' },
};
const ASSESSMENT_KEYS = Object.keys(ASSESSMENT_TYPES);

// Per-campaign mix. Each row sums to 1.0. Authored by hand to be plausible:
// runtime upgrades (Java/Node/Python) carry meaningful Coverity share because
// SAST often catches related code-level bugs alongside the runtime CVE; TLS,
// MFA and rotation campaigns lean config + pentest; cloud-adjacent campaigns
// pick up CSPM share.
const ASSESSMENT_MIX_BY_BUCKET = {
  'patch-log4j':         { continuous: 0.50, dependency: 0.45, coverity: 0.05 },
  'upgrade-openssl':     { continuous: 0.65, dependency: 0.30, coverity: 0.05 },
  'patch-apache':        { continuous: 0.75, config: 0.20, pentest: 0.05 },
  'upgrade-java':        { continuous: 0.30, dependency: 0.30, coverity: 0.40 },
  'upgrade-ubuntu':      { continuous: 0.85, config: 0.15 },
  'patch-kernel':        { continuous: 0.95, config: 0.05 },
  'upgrade-node':        { continuous: 0.25, dependency: 0.40, coverity: 0.35 },
  'upgrade-postgres':    { continuous: 0.50, config: 0.35, dependency: 0.10, pentest: 0.05 },
  'patch-nginx':         { continuous: 0.80, config: 0.15, pentest: 0.05 },
  'upgrade-rhel':        { continuous: 0.92, config: 0.08 },
  'upgrade-python':      { continuous: 0.30, dependency: 0.35, coverity: 0.35 },
  'upgrade-windows':     { continuous: 0.85, config: 0.10, pentest: 0.05 },
  'upgrade-mysql':       { continuous: 0.50, config: 0.35, dependency: 0.10, pentest: 0.05 },
  'rotate-ssh':          { pentest: 0.50, config: 0.40, continuous: 0.10 },
  'patch-docker':        { continuous: 0.55, config: 0.25, dependency: 0.10, cloud: 0.10 },
  'configure-tls':       { config: 0.45, cloud: 0.35, continuous: 0.20 },
  'replace-certs':       { continuous: 0.40, config: 0.30, cloud: 0.30 },
  'upgrade-mongo':       { continuous: 0.50, config: 0.35, dependency: 0.10, pentest: 0.05 },
  'upgrade-k8s':         { cloud: 0.45, continuous: 0.30, config: 0.25 },
  'patch-jenkins':       { continuous: 0.45, dependency: 0.25, config: 0.20, pentest: 0.10 },
  'upgrade-redis':       { continuous: 0.55, config: 0.35, dependency: 0.10 },
  'disable-tls10':       { config: 0.45, cloud: 0.30, continuous: 0.25 },
  'patch-elasticsearch': { continuous: 0.55, config: 0.25, dependency: 0.15, pentest: 0.05 },
  'decommission-eol':    { pentest: 0.40, continuous: 0.35, config: 0.25 },
  'enable-mfa':          { pentest: 0.50, config: 0.30, cloud: 0.20 },
};

// Returns the proportion of this bucket's findings attributable to the
// active assessment-source filter. The filter is a Set of selected types;
// empty set means "no filter" → 1.0. With one or more selected, return the
// sum of the bucket's mix shares for those types.
function bucketShare(bucket, assessment) {
  if (!assessment || assessment.size === 0) return 1;
  const mix = bucket.assessmentMix || {};
  let s = 0;
  assessment.forEach(k => { s += mix[k] || 0; });
  return s;
}

const BUCKETS_DEF = [
  ['patch-log4j',         'Patch',     'Log4j Library',          0.5, 47200, [0.52, 0.32, 0.13, 0.03], [0.35, 0.05, 0.45, 0.15], 7],
  ['upgrade-openssl',     'Upgrade',   'OpenSSL',                1.0, 33800, [0.28, 0.42, 0.22, 0.08], [0.55, 0.10, 0.20, 0.15], 5],
  ['patch-apache',        'Patch',     'Apache HTTP Server',     0.75, 28400, [0.18, 0.38, 0.32, 0.12], [0.50, 0.02, 0.40, 0.08], 4],
  ['upgrade-java',        'Upgrade',   'Java JRE',               1.5, 22100, [0.22, 0.40, 0.28, 0.10], [0.30, 0.05, 0.55, 0.10], 6],
  ['upgrade-ubuntu',      'Upgrade',   'Ubuntu OS',              2.5, 18600, [0.15, 0.35, 0.35, 0.15], [0.85, 0.05, 0.05, 0.05], 12],
  ['patch-kernel',        'Patch',     'Linux Kernel',           1.5, 15400, [0.30, 0.45, 0.20, 0.05], [0.80, 0.10, 0.05, 0.05], 8],
  ['upgrade-node',        'Upgrade',   'Node.js Runtime',        1.0, 13200, [0.20, 0.40, 0.30, 0.10], [0.15, 0.02, 0.78, 0.05], 5],
  ['upgrade-postgres',    'Upgrade',   'PostgreSQL',             2.0, 9800,  [0.25, 0.40, 0.25, 0.10], [0.05, 0.85, 0.05, 0.05], 3],
  ['patch-nginx',         'Patch',     'Nginx',                  0.5, 8900,  [0.12, 0.30, 0.40, 0.18], [0.55, 0.02, 0.38, 0.05], 3],
  ['upgrade-rhel',        'Upgrade',   'RHEL OS',                3.0, 8200,  [0.18, 0.38, 0.34, 0.10], [0.92, 0.04, 0.02, 0.02], 14],
  ['upgrade-python',      'Upgrade',   'Python Runtime',         1.0, 7600,  [0.15, 0.35, 0.35, 0.15], [0.20, 0.05, 0.65, 0.10], 4],
  ['upgrade-windows',     'Upgrade',   'Windows Server',         2.5, 6400,  [0.22, 0.42, 0.28, 0.08], [0.90, 0.05, 0.03, 0.02], 10],
  ['upgrade-mysql',       'Upgrade',   'MySQL',                  2.0, 5300,  [0.20, 0.38, 0.30, 0.12], [0.05, 0.88, 0.05, 0.02], 3],
  ['rotate-ssh',          'Rotate',    'SSH Keys',               0.25, 5100, [0.08, 0.22, 0.45, 0.25], [0.75, 0.10, 0.10, 0.05], 1],
  ['patch-docker',        'Patch',     'Docker Engine',          1.0, 4700,  [0.18, 0.35, 0.32, 0.15], [0.30, 0.05, 0.10, 0.55], 4],
  ['configure-tls',       'Configure', 'TLS Settings',           0.5, 4200,  [0.05, 0.25, 0.45, 0.25], [0.40, 0.10, 0.45, 0.05], 2],
  ['replace-certs',       'Replace',   'Expired Certificates',   0.5, 3800,  [0.12, 0.40, 0.35, 0.13], [0.45, 0.10, 0.40, 0.05], 1],
  ['upgrade-mongo',       'Upgrade',   'MongoDB',                1.5, 3100,  [0.22, 0.38, 0.28, 0.12], [0.05, 0.85, 0.05, 0.05], 3],
  ['upgrade-k8s',         'Upgrade',   'Kubernetes',             4.0, 2400,  [0.30, 0.42, 0.22, 0.06], [0.25, 0.05, 0.05, 0.65], 6],
  ['patch-jenkins',       'Patch',     'Jenkins',                0.75, 1900, [0.20, 0.40, 0.30, 0.10], [0.10, 0.02, 0.85, 0.03], 4],
  ['upgrade-redis',       'Upgrade',   'Redis',                  1.0, 1700,  [0.10, 0.30, 0.42, 0.18], [0.05, 0.85, 0.05, 0.05], 2],
  ['disable-tls10',       'Disable',   'TLS 1.0/1.1',            0.25, 1500, [0.18, 0.45, 0.30, 0.07], [0.50, 0.10, 0.35, 0.05], 1],
  ['patch-elasticsearch', 'Patch',     'Elasticsearch',          1.0, 1200,  [0.22, 0.38, 0.30, 0.10], [0.10, 0.80, 0.05, 0.05], 4],
  ['decommission-eol',    'Decommission', 'End-of-Life Software', 6.0, 850,  [0.40, 0.40, 0.18, 0.02], [0.55, 0.20, 0.20, 0.05], 2],
  ['enable-mfa',          'Enable',    'MFA on Admin Consoles',  0.5, 620,   [0.35, 0.45, 0.18, 0.02], [0.20, 0.10, 0.65, 0.05], 1],
];

const SEV_MIX_BY_BUCKET = Object.fromEntries(BUCKETS_DEF.map(b => [b[0], b[5]]));

// realistic name fragments for asset id generation
const APP_FRAGS    = ['checkout', 'auth', 'billing', 'search', 'inventory', 'gateway', 'orders', 'shipping', 'notify', 'pricing', 'risk', 'feed'];
const DB_FRAGS     = ['users', 'orders', 'inventory', 'analytics', 'sessions', 'products', 'payments', 'audit', 'logs'];
const CTR_FRAGS    = ['runner', 'worker', 'sidecar', 'cron', 'sandbox', 'builder', 'queue', 'cache'];
const TEAMS        = ['payments', 'platform', 'growth', 'data', 'infra', 'ml', 'security', 'commerce', 'ops', 'web'];

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE ROSTER  ─  fake employees for assignment
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#dc6e3d', '#3b8c5b', '#2f6f9e', '#8a4a98', '#a36b1d',
  '#a83253', '#356d6b', '#6b5dba', '#8b6f3d', '#5c8a2c',
  '#ae3a3a', '#3d7a8c', '#7a4a3d', '#5a8038', '#9c4a7a',
];

function makePerson(first, last, team, role) {
  const id = `${first}.${last}`.toLowerCase();
  const initials = (first[0] + last[0]).toUpperCase();
  const color = AVATAR_COLORS[hashStr(id) % AVATAR_COLORS.length];
  return { id, name: `${first} ${last}`, first, last, team, role, initials, color };
}

const PEOPLE = [
  makePerson('Jane',     'Doe',       'security',  'Security Eng'),
  makePerson('Marcus',   'Chen',      'security',  'Security Eng'),
  makePerson('Priya',    'Patel',     'security',  'Security Lead'),
  makePerson('Sam',      'Okafor',    'platform',  'Platform Eng'),
  makePerson('Lukas',    'Mueller',   'platform',  'Platform Eng'),
  makePerson('Iris',     'Tanaka',    'platform',  'Platform Lead'),
  makePerson('Akira',    'Yamada',    'infra',     'SRE'),
  makePerson('Maria',    'Garcia',    'infra',     'SRE'),
  makePerson('Derek',    'Ross',      'infra',     'Infra Lead'),
  makePerson('Noor',     'Khan',      'data',      'Data Eng'),
  makePerson('Chen',     'Liu',       'data',      'DBA'),
  makePerson('Rosa',     'Silva',     'payments',  'Backend Eng'),
  makePerson('Ola',      'Johansson', 'payments',  'Backend Eng'),
  makePerson('Fatima',   'Khalil',    'payments',  'Tech Lead'),
  makePerson('Kai',      'Weber',     'web',       'Frontend Eng'),
  makePerson('Sofia',    'Rossi',     'web',       'Frontend Eng'),
  makePerson('Benji',    'Park',      'commerce',  'Backend Eng'),
  makePerson('Hana',     'Kim',       'commerce',  'Tech Lead'),
  makePerson('Theo',     'Singh',     'ops',       'Ops Eng'),
  makePerson('Yara',     'Hassan',    'ops',       'Ops Lead'),
  makePerson('Ren',      'Watanabe',  'ml',        'ML Eng'),
  makePerson('Eva',      'Nilsson',   'growth',    'Backend Eng'),
];
const PEOPLE_BY_ID = new Map(PEOPLE.map(p => [p.id, p]));

// ─────────────────────────────────────────────────────────────────────────────
// BUILD BUCKETS — pre-computed aggregates
// ─────────────────────────────────────────────────────────────────────────────
function buildBuckets() {
  return BUCKETS_DEF.map(([id, verb, noun, baseHours, rawCount, sevMix, assetMix, findingsPerAsset]) => {
    // Apply the global scale to count. findingsPerAsset stays unchanged, so
    // affected-asset counts cascade down proportionally and per-asset
    // finding density stays realistic.
    const count = Math.max(1, Math.round(rawCount * FINDINGS_SCALE));
    const sevCounts = sevMix.map(p => Math.round(count * p));
    const assetCounts = assetMix.map(p => Math.round(count * p));
    const affectedAssetsByType = assetCounts.map(c => Math.max(1, Math.round(c / findingsPerAsset)));
    const affectedAssets = affectedAssetsByType.reduce((a, b) => a + b, 0);
    // severity-weighted risk (CVSS-ish)
    const riskScore = sevCounts[0] * 10 + sevCounts[1] * 7.5 + sevCounts[2] * 5 + sevCounts[3] * 2;
    // SLA aggregates
    const overdueBySev = sevCounts.map((c, i) => Math.round(c * OVERDUE_RATE[i]));
    const approachingBySev = sevCounts.map((c, i) => Math.round(c * APPROACHING_RATE[i]));
    const overdueTotal = overdueBySev.reduce((a, b) => a + b, 0);
    const approachingTotal = approachingBySev.reduce((a, b) => a + b, 0);
    // weighted "policy pressure" — how badly out-of-policy this campaign is
    const policyPressure = overdueBySev[0] * 10 + overdueBySev[1] * 4 + overdueBySev[2] * 1.5 + overdueBySev[3] * 0.5;
    return {
      id, verb, noun, baseHours, count, findingsPerAsset,
      sevCounts, assetCounts, affectedAssetsByType, affectedAssets,
      riskScore,
      overdueBySev, approachingBySev, overdueTotal, approachingTotal, policyPressure,
      assetMix: Object.fromEntries(ASSET_TYPE_KEYS.map((k, i) => [k, assetCounts[i]])),
      assessmentMix: ASSESSMENT_MIX_BY_BUCKET[id] || {},
    };
  });
}

// hours = sum over (assetType, env) of (affectedAssets × p_env × base × asset_mult × env_mult × avg_crit_mult)
function computeEffectiveHours(bucket, baseHoursOverride) {
  const base = baseHoursOverride ?? bucket.baseHours;
  let total = 0;
  ASSET_TYPE_KEYS.forEach((k, i) => {
    const aa = bucket.affectedAssetsByType[i];
    if (!aa) return;
    const aMult = ASSET_TYPES[k].multiplier;
    ENV_MIX.forEach(([env, p]) => {
      total += aa * p * base * aMult * ENV_MULT[env] * avgCritMult(env);
    });
  });
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD ASSET WORLD — registry + bucket assignment + reverse index + metadata
// ─────────────────────────────────────────────────────────────────────────────
function buildAssetWorld(buckets) {
  const rng = makeRng(42);
  const REGISTRY = 5000;
  const assets = [];
  const orgTypeMix = [0.50, 0.10, 0.30, 0.10];

  // synthetic name pools for metadata
  const FIRST = ['jane', 'john', 'priya', 'maria', 'akira', 'lukas', 'ola', 'fatima', 'chen', 'sam', 'rosa', 'derek', 'noor', 'kai', 'iris'];
  const LAST = ['doe', 'smith', 'patel', 'garcia', 'tanaka', 'mueller', 'johansson', 'khan', 'liu', 'kim', 'okafor', 'singh', 'ross', 'weber', 'silva'];
  const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

  for (let i = 0; i < REGISTRY; i++) {
    const typeIdx = pickFromMix(orgTypeMix, rng());
    const type = ASSET_TYPE_KEYS[typeIdx];
    const envIdx = pickFromMix(ENV_MIX.map(e => e[1]), rng());
    const env = ENV_MIX[envIdx][0];
    const critIdx = pickFromMix(CRIT_MIX_BY_ENV[env], rng());
    const criticality = CRIT_KEYS[critIdx];
    const team = TEAMS[Math.floor(rng() * TEAMS.length)];
    const envShort = env.slice(0, 3).toLowerCase();

    let id;
    if (type === 'server') {
      id = `srv-${envShort}-${(1000 + i).toString().slice(-4)}`;
    } else if (type === 'database') {
      const f = DB_FRAGS[Math.floor(rng() * DB_FRAGS.length)];
      id = `db-${f}-${envShort}-${(i % 100).toString().padStart(2, '0')}`;
    } else if (type === 'app') {
      const f = APP_FRAGS[Math.floor(rng() * APP_FRAGS.length)];
      id = `app-${f}-${envShort}-${(i % 50).toString().padStart(2, '0')}`;
    } else {
      const f = CTR_FRAGS[Math.floor(rng() * CTR_FRAGS.length)];
      id = `ctr-${f}-${(i % 1000).toString().padStart(3, '0')}`;
    }

    // metadata — fake but realistic-looking
    const ipFirst = env === 'Production' ? 10 : env === 'Staging' ? 172 : 192;
    const ipSecond = env === 'Production' ? 42 : env === 'Staging' ? 16 : 168;
    const ip = `${ipFirst}.${ipSecond}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`;
    const region = REGIONS[Math.floor(rng() * REGIONS.length)];
    const az = ['a', 'b', 'c'][Math.floor(rng() * 3)];
    const deployDays = 180 + Math.floor(rng() * (365 * 4));
    const modDays = Math.floor(rng() * 90);
    const deployedAt = new Date(Date.now() - deployDays * 86400000).toISOString().slice(0, 10);
    const lastModified = new Date(Date.now() - modDays * 86400000).toISOString().slice(0, 10);
    const primaryOwner = `${FIRST[Math.floor(rng() * FIRST.length)]}.${LAST[Math.floor(rng() * LAST.length)]}`;
    const secondaryOwner = `${FIRST[Math.floor(rng() * FIRST.length)]}.${LAST[Math.floor(rng() * LAST.length)]}`;
    const tags = [];
    if (criticality === 'T1') tags.push('tier-1');
    if (env === 'Production' && rng() < 0.4) tags.push('pci-scope');
    if (type === 'database') tags.push('data-store');
    if (type === 'app' && rng() < 0.5) tags.push('public-facing');
    if (rng() < 0.3) tags.push('soc2-scope');
    if (rng() < 0.2) tags.push('regulated');

    assets.push({
      id, type, env, criticality, team,
      meta: {
        ip,
        hostname: `${id}.${ORG.internalDomain}`,
        region,
        az: `${region}${az}`,
        cmdbId: `CI-${(100000 + Math.floor(rng() * 899999))}`,
        deployedAt, lastModified,
        primaryOwner, secondaryOwner,
        primaryEmail: `${primaryOwner}@${ORG.emailDomain}`,
        secondaryEmail: `${secondaryOwner}@${ORG.emailDomain}`,
        slackChannel: `#team-${team}`,
        pagerDuty: `team-${team}-${criticality === 'T1' ? 'p1' : 'p2'}`,
        runbookUrl: `https://runbook.${ORG.internalDomain}/assets/${id}`,
        monitoringUrl: `https://grafana.${ORG.internalDomain}/d/${id.slice(-8)}`,
        repoUrl: `https://git.${ORG.internalDomain}/infra/${type}-config`,
        tags,
      },
    });
  }

  const assetMap = new Map(assets.map(a => [a.id, a]));
  const bucketAssets = new Map();
  const assetFindings = new Map();

  buckets.forEach(b => {
    const bRng = makeRng(hashStr(b.id));
    const candidates = assets.filter(a => b.assetMix[a.type] > 0);
    const target = Math.min(candidates.length, Math.max(40, Math.round(b.affectedAssets * 0.35)));
    const weighted = candidates.map(a => {
      const typeShare = b.assetMix[a.type] / b.count;
      const critWeight = a.criticality === 'T1' ? 1.2 : a.criticality === 'T2' ? 1.0 : 0.85;
      return [bRng() / (typeShare * critWeight + 0.1), a];
    });
    weighted.sort((x, y) => x[0] - y[0]);
    const picked = weighted.slice(0, target).map(([, a]) => a);

    const sevMix = SEV_MIX_BY_BUCKET[b.id];
    const list = [];
    picked.forEach(a => {
      const findingsHere = 1 + Math.floor(bRng() * (b.findingsPerAsset * 1.6));
      const sevs = [];
      const ages = [];
      for (let j = 0; j < findingsHere; j++) {
        const s = pickFromMix(sevMix, bRng());
        sevs.push(s);
        ages.push(generateAge(s, bRng));
      }
      const sevCounts = [0, 0, 0, 0];
      const overdueBySev = [0, 0, 0, 0];
      const approachingBySev = [0, 0, 0, 0];
      let oldestAge = 0;
      sevs.forEach((s, idx) => {
        sevCounts[s]++;
        const age = ages[idx];
        if (age > oldestAge) oldestAge = age;
        const status = slaStatus(s, age);
        if (status === 'overdue') overdueBySev[s]++;
        else if (status === 'approaching') approachingBySev[s]++;
      });
      const overdueTotal = overdueBySev.reduce((x, y) => x + y, 0);
      const approachingTotal = approachingBySev.reduce((x, y) => x + y, 0);
      const worstSeverity = Math.min(...sevs);
      const cve = `CVE-202${4 + Math.floor(bRng() * 2)}-${(10000 + Math.floor(bRng() * 89999)).toString()}`;
      const lastSeen = `${1 + Math.floor(bRng() * 28)}d`;
      const entry = {
        assetId: a.id, bucketId: b.id,
        findingsCount: findingsHere,
        sevCounts, sevs, ages,
        overdueBySev, approachingBySev, overdueTotal, approachingTotal, oldestAge,
        worstSeverity, cve, lastSeen,
      };
      list.push(entry);
      if (!assetFindings.has(a.id)) assetFindings.set(a.id, []);
      assetFindings.get(a.id).push(entry);
    });
    bucketAssets.set(b.id, list);
  });

  // burndown — global, per bucket, per asset
  const totalFindings = buckets.reduce((s, b) => s + b.count, 0);
  const burndowns = {
    global: generateBurndown(totalFindings, 90, hashStr('global')),
    byBucket: new Map(buckets.map(b => [b.id, generateBurndown(b.count, 90, hashStr(b.id) + 1)])),
    byAsset: new Map(),
  };
  // per-asset burndown derived from sum of its current finding count
  assetFindings.forEach((entries, assetId) => {
    const cur = entries.reduce((s, e) => s + e.findingsCount, 0);
    burndowns.byAsset.set(assetId, generateBurndown(cur, 90, hashStr(assetId)));
  });

  return { assets, assetMap, bucketAssets, assetFindings, burndowns };
}

// hours estimate for a single asset across one or more campaigns
function assetHours(asset, entries, buckets, estimates) {
  const aMult = ASSET_TYPES[asset.type].multiplier;
  const eMult = ENV_MULT[asset.env];
  const cMult = CRITICALITY[asset.criticality].multiplier;
  let total = 0;
  entries.forEach(en => {
    const b = buckets.find(x => x.id === en.bucketId);
    const base = estimates[b.id] ?? b.baseHours;
    total += base * aMult * eMult * cMult; // one fix per (asset, bucket)
  });
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDINGS — expand (asset, bucket) entries into individual finding records
// ─────────────────────────────────────────────────────────────────────────────
// KEV (CISA Known Exploited Vulnerability) and POC (public proof-of-concept)
// probabilities by severity index. KEV implies POC.
const KEV_RATE = [0.22, 0.08, 0.02, 0.005];
const POC_RATE = [0.35, 0.18, 0.07, 0.02];
// Workflow status distribution. Most findings are Open.
const STATUS_OPTS = [
  ['Open',         0.90],
  ['In Progress',  0.05],
  ['Risk Accepted',0.03],
  ['Fixed',        0.01],
  ['False Positive',0.01],
];
const TODAY_MS = Date.now();

function materializeFindings(entry, asset, bucket) {
  // Deterministic per (bucketId, assetId): same finding always renders the same.
  const rng = makeRng(hashStr(entry.bucketId + ':' + entry.assetId) + 7);
  const out = [];
  const sevBase = [2400, 1500, 700, 200];
  const critMult = asset.criticality === 'T1' ? 1.15 : asset.criticality === 'T2' ? 1.00 : 0.90;
  const envMult  = asset.env === 'Production' ? 1.10 : asset.env === 'Staging' ? 1.00 : 0.90;

  // Pre-compute cumulative assessment-mix table so each finding can pick its
  // source deterministically using one rng draw.
  const mix = bucket.assessmentMix || {};
  const assessmentTable = [];
  let cum = 0;
  ASSESSMENT_KEYS.forEach(k => {
    const p = mix[k] || 0;
    if (p > 0) { cum += p; assessmentTable.push([k, cum]); }
  });
  if (assessmentTable.length === 0) assessmentTable.push(['continuous', 1]); // safety

  for (let i = 0; i < entry.findingsCount; i++) {
    const sev = entry.sevs[i];
    const age = entry.ages[i];
    const status = slaStatus(sev, age);

    // KEV / POC — KEV implies POC
    const kev = rng() < KEV_RATE[sev];
    const poc = kev ? true : rng() < POC_RATE[sev];

    // Priority score (0..4000-ish)
    const kevBonus = kev ? (800 + rng() * 400) : 0;
    const pocBonus = poc && !kev ? (200 + rng() * 200) : 0;
    const noise = (rng() - 0.5) * 200;
    const raw = (sevBase[sev] + kevBonus + pocBonus) * critMult * envMult + noise;
    const priorityScore = Math.max(0, Math.min(4000, Math.round(raw)));

    // First found = today minus age days
    const firstFound = new Date(TODAY_MS - age * 86400000).toISOString().slice(0, 10);

    // CVE: synthesize per-finding (loosely related to entry.cve year).
    const year = 2020 + Math.floor(rng() * 6);
    const cve = `CVE-${year}-${(10000 + Math.floor(rng() * 89999)).toString()}`;

    // Workflow status — weighted pick
    const r = rng();
    let acc = 0;
    let workflowStatus = 'Open';
    for (const [label, p] of STATUS_OPTS) {
      acc += p;
      if (r < acc) { workflowStatus = label; break; }
    }

    // Assessment type — pick from the campaign's mix
    const ar = rng();
    let assessment = assessmentTable[assessmentTable.length - 1][0];
    for (const [k, c] of assessmentTable) {
      if (ar < c) { assessment = k; break; }
    }

    // Finding id — deterministic, short, scannable
    const id = `F-${bucket.id.slice(0, 4).toUpperCase()}-${entry.assetId.slice(-4)}-${(i + 1).toString().padStart(3, '0')}`;

    out.push({
      id,
      bucketId: entry.bucketId,
      assetId:  entry.assetId,
      severity: sev,
      age,
      slaState: status, // 'ok' | 'approaching' | 'overdue'
      cve,
      kev, poc,
      priorityScore,
      firstFound,
      workflowStatus,
      assessment,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT
// ─────────────────────────────────────────────────────────────────────────────
const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
const fmtHours = (h) => {
  if (h < 1) return `${(h * 60).toFixed(0)}m`;
  if (h < 100) return `${h.toFixed(1)}h`;
  if (h < 10000) return `${Math.round(h).toLocaleString()}h`;
  const days = h / 8;
  return `${Math.round(days).toLocaleString()}d`;
};
const fmtHoursDetail = (h) => {
  const days = h / 8;
  if (days >= 1) return `~${Math.round(h).toLocaleString()} hours · ${Math.round(days).toLocaleString()} person-days`;
  return `~${h.toFixed(1)} hours`;
};

// ─────────────────────────────────────────────────────────────────────────────
// HASH ROUTING — #/, #/c/{bucketId}, #/c/{bucketId}/findings,
//   #/c/{bucketId}/a/{assetId}, #/c/{bucketId}/a/{assetId}/findings  (?theme=dark)
// ─────────────────────────────────────────────────────────────────────────────
function parseHash() {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').slice(1) || '/';
  const [pathPart, queryPart] = raw.split('?');
  const params = new URLSearchParams(queryPart || '');
  const themeParam = params.get('theme');
  const theme = (themeParam && THEMES[themeParam]) ? themeParam : DEFAULT_THEME;
  const assessmentParam = params.get('assessment');
  // Multi-select assessment filter — accept comma-separated list. Each entry
  // must match a known type or it's silently dropped. Empty / missing → no
  // filter (empty Set).
  const assessment = new Set();
  if (assessmentParam) {
    assessmentParam.split(',').forEach(k => {
      const t = k.trim();
      if (t && ASSESSMENT_TYPES[t]) assessment.add(t);
    });
  }
  const onlyMine = params.get('mine') === '1';
  const parts = pathPart.split('/').filter(Boolean);
  let view = { kind: 'overview' };
  // /c/{bucket}/a/{asset}/findings
  if (parts[0] === 'c' && parts[1] && parts[2] === 'a' && parts[3] && parts[parts.length - 1] === 'findings') {
    view = {
      kind: 'findings',
      bucketId: parts[1],
      assetId: decodeURIComponent(parts.slice(3, parts.length - 1).join('/')),
    };
  // /c/{bucket}/findings
  } else if (parts[0] === 'c' && parts[1] && parts[2] === 'findings') {
    view = { kind: 'findings', bucketId: parts[1], assetId: null };
  // /c/{bucket}/a/{asset}
  } else if (parts[0] === 'c' && parts[1] && parts[2] === 'a' && parts[3]) {
    view = { kind: 'asset', bucketId: parts[1], assetId: decodeURIComponent(parts.slice(3).join('/')) };
  // /c/{bucket}
  } else if (parts[0] === 'c' && parts[1]) {
    view = { kind: 'bucket', bucketId: parts[1] };
  }
  return { ...view, theme, assessment, onlyMine };
}
function serializeHash(view, theme, assessment, onlyMine) {
  let path = '/';
  if (view.kind === 'bucket') path = `/c/${view.bucketId}`;
  else if (view.kind === 'asset') path = `/c/${view.bucketId}/a/${encodeURIComponent(view.assetId)}`;
  else if (view.kind === 'findings') {
    path = view.assetId
      ? `/c/${view.bucketId}/a/${encodeURIComponent(view.assetId)}/findings`
      : `/c/${view.bucketId}/findings`;
  }
  const qs = [];
  if (theme && theme !== DEFAULT_THEME) qs.push(`theme=${theme}`);
  if (assessment && assessment.size > 0) qs.push(`assessment=${[...assessment].join(',')}`);
  if (onlyMine) qs.push('mine=1');
  const q = qs.length ? `?${qs.join('&')}` : '';
  return `#${path}${q}`;
}
function useRoute() {
  const [state, setState] = useState(() => parseHash());
  useEffect(() => {
    const onHash = () => setState(parseHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);
  const navigate = useCallback((nextView, nextTheme, nextAssessment, nextOnlyMine) => {
    const view = nextView ?? { kind: state.kind, bucketId: state.bucketId, assetId: state.assetId };
    const theme = nextTheme ?? state.theme;
    const assessment = nextAssessment ?? state.assessment;
    const onlyMine = nextOnlyMine !== undefined ? nextOnlyMine : state.onlyMine;
    const h = serializeHash(view, theme, assessment, onlyMine);
    if (window.location.hash !== h) {
      window.location.hash = h; // triggers hashchange → setState
    } else {
      setState({ ...view, theme, assessment, onlyMine });
    }
  }, [state]);
  return [state, navigate];
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES — CSS variables for both themes
// ─────────────────────────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

      :root {
        /* fallback values for first paint — overridden at runtime by applyThemeVars */
        --bg: #faf7ef;
        --surface: #ffffff;
        --surface-2: #f3eee2;
        --surface-3: #e7e0cc;
        --border: #ddd5bf;
        --border-bright: #a89f86;
        --text: #1a1612;
        --text-dim: #5b554a;
        --text-faint: #8a8273;
        --accent: #b54a14;
        --accent-2: #7a3008;
        --accent-soft: #f1d9c4;
        --sev-critical: #dc2626;
        --sev-high: #ea580c;
        --sev-medium: #ca8a04;
        --sev-low: #64748b;
        --crit-t1: #dc2626;
        --crit-t2: #b54a14;
        --crit-t3: #64748b;
        --good: #1f7a3e;
        --wash-opacity: 0.14;
        --grain-opacity: 0.5;
      }

      * { box-sizing: border-box; }
      html, body, #root { height: 100%; margin: 0; }
      body {
        background: var(--bg);
        color: var(--text);
        font-family: 'IBM Plex Sans', system-ui, sans-serif;
        font-feature-settings: 'cv11', 'ss01';
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-size: 14px;
        line-height: 1.5;
        transition: background-color 200ms ease, color 200ms ease;
      }
      .display { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'ss01', 'ss02'; letter-spacing: -0.02em; }
      .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-feature-settings: 'zero', 'ss02'; }
      .label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10.5px; font-weight: 500; color: var(--text-dim); }
      button { font-family: inherit; cursor: pointer; }
      ::selection { background: var(--accent); color: var(--bg); }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: var(--bg); }
      ::-webkit-scrollbar-thumb { background: var(--surface-3); }
      ::-webkit-scrollbar-thumb:hover { background: var(--border-bright); }

      .card-hover:hover { border-color: var(--border-bright) !important; }
      .clickable { cursor: pointer; transition: all 120ms ease; }
      .clickable:hover { background: var(--surface-2); }

      @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      .slide-in { animation: slideIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1); }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .fade-in { animation: fadeIn 200ms ease; }

      .grain::before {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.45 0 0 0 0 0.35 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
        opacity: var(--grain-opacity);
      }

      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
    `}</style>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SeverityBar({ counts, total, height = 4 }) {
  const t = total || counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ display: 'flex', height, width: '100%', overflow: 'hidden', background: 'var(--surface-3)' }}>
      {counts.map((c, i) => c > 0 && (
        <div key={i} style={{ width: `${(c / t) * 100}%`, background: SEV_COLOR[i] }} />
      ))}
    </div>
  );
}
function StatNum({ value, label, sub, accent, big = false }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="display" style={{
        fontSize: big ? 56 : 40,
        fontWeight: 400,
        lineHeight: 1,
        color: accent || 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>{sub}</div>}
    </div>
  );
}
function SevDot({ sev, size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, background: SEV_COLOR[sev], borderRadius: '50%' }} />;
}
function CritBadge({ tier, sm = false }) {
  const c = CRITICALITY[tier];
  const Icon = c.icon;
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: sm ? '2px 6px' : '3px 8px',
      fontSize: sm ? 10 : 11,
      fontWeight: 500,
      color: c.color,
      border: `1px solid ${c.color}`,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: 'transparent',
    }}>
      <Icon size={sm ? 9 : 10} strokeWidth={2} />
      {c.short}
    </span>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// AVATAR — circular, MUI-style, color-coded initials with optional photo
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ person, size = 28, ring = true }) {
  if (!person) return null;
  const fontSize = Math.round(size * 0.4);
  return (
    <div
      title={`${person.name} · ${person.role} · team-${person.team}`}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: person.color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 600, fontFamily: "'IBM Plex Sans', sans-serif",
        letterSpacing: '0.02em',
        flexShrink: 0,
        border: ring ? `2px solid var(--bg)` : 'none',
        boxSizing: 'border-box',
      }}
    >
      {person.initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM BUTTON — per (campaign, asset) marker that the current user is going
// to work this asset. Toggles between a subtle "Claim" affordance and the
// user's avatar circle. Stops click propagation so the row's drill-down
// click handler doesn't fire.
// ─────────────────────────────────────────────────────────────────────────────
function ClaimButton({ claimed, onToggle, currentUser, sm = false }) {
  if (!currentUser) return null;
  const size = sm ? 18 : 22;
  const handle = (e) => { e.stopPropagation(); onToggle(); };
  if (claimed) {
    return (
      <button
        onClick={handle}
        title={`Claimed by ${currentUser.name} — click to release`}
        style={{
          background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Avatar person={currentUser} size={size} ring={false} />
      </button>
    );
  }
  return (
    <button
      onClick={handle}
      title="Claim this asset — mark that you'll work it"
      className="claim-btn"
      style={{
        background: 'transparent', color: 'var(--text-dim)',
        border: `1px solid var(--border)`, padding: sm ? '2px 8px' : '3px 10px',
        fontSize: sm ? 10 : 11, fontWeight: 500, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        letterSpacing: '0.04em',
      }}
    >
      <UserPlus size={sm ? 9 : 10} /> Claim
    </button>
  );
}

// AvatarStack — overlapped circles with a +N overflow chip
function AvatarStack({ people, size = 28, max = 4, onClick }) {
  if (!people || people.length === 0) return null;
  const overflow = people.length - max;
  const shown = overflow > 0 ? people.slice(0, max) : people;
  const overlap = Math.round(size * 0.32);
  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: shown.length - i, position: 'relative' }}>
          <Avatar person={p} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={`${overflow} more`}
          style={{
            marginLeft: -overlap, zIndex: 0,
            width: size, height: size, borderRadius: '50%',
            background: 'var(--surface-3)', color: 'var(--text)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.36), fontWeight: 600,
            fontFamily: "'IBM Plex Sans', sans-serif",
            border: `2px solid var(--bg)`, boxSizing: 'border-box',
          }}
        >+{overflow}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE PICKER MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PeoplePickerModal({ open, initialSelected, bucket, onClose, onApply }) {
  const [selected, setSelected] = useState(new Set(initialSelected || []));
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected || []));
      setSearch('');
      setTeamFilter('all');
    }
  }, [open, initialSelected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PEOPLE.filter(p => {
      if (teamFilter !== 'all' && p.team !== teamFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) ||
             p.id.includes(q) ||
             p.role.toLowerCase().includes(q) ||
             p.team.toLowerCase().includes(q);
    });
  }, [search, teamFilter]);

  if (!open) return null;

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const apply = () => {
    onApply(Array.from(selected));
    onClose();
  };
  const teamsPresent = Array.from(new Set(PEOPLE.map(p => p.team))).sort();

  return (
    <>
      <div onClick={onClose} className="fade-in" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60,
      }}/>
      <div className="fade-in" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(560px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 48px)',
        background: 'var(--surface)', border: `1px solid var(--border-bright)`,
        zIndex: 61, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Assign people</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>
              {bucket ? <><span style={{ color: 'var(--text-dim)' }}>{bucket.verb}</span> {bucket.noun}</> : 'Campaign'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4 }}>
            <X size={18}/>
          </button>
        </div>

        {/* search + filter */}
        <div style={{ padding: '14px 24px', borderBottom: `1px solid var(--border)`, display: 'flex', gap: 8, background: 'var(--surface-2)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={13} color="var(--text-dim)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role, or team..."
              autoFocus
              style={{
                width: '100%', background: 'var(--bg)', color: 'var(--text)',
                border: `1px solid var(--border)`, padding: '7px 10px 7px 30px', fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <FilterSelect value={teamFilter} onChange={setTeamFilter} options={[
            ['all', 'All teams'],
            ...teamsPresent.map(t => [t, `team-${t}`]),
          ]} w={130} />
        </div>

        {/* selected summary */}
        <div style={{ padding: '10px 24px', borderBottom: `1px solid var(--border)`, fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span>
            {selected.size === 0
              ? 'No one assigned yet'
              : `${selected.size} ${selected.size === 1 ? 'person' : 'people'} selected`}
          </span>
          {selected.size > 0 && (
            <AvatarStack people={Array.from(selected).map(id => PEOPLE_BY_ID.get(id)).filter(Boolean)} size={22} max={6} />
          )}
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              No people match.
            </div>
          )}
          {filtered.map(p => {
            const isSelected = selected.has(p.id);
            return (
              <button
                key={p.id} onClick={() => toggle(p.id)}
                className="clickable"
                style={{
                  width: '100%', background: isSelected ? 'var(--accent-soft)' : 'transparent',
                  border: 'none', borderBottom: `1px solid var(--border)`,
                  padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12,
                  color: 'var(--text)', textAlign: 'left',
                }}
              >
                <Avatar person={p} size={32} ring={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {p.role} <span style={{ color: 'var(--text-faint)' }}>·</span> team-{p.team}
                  </div>
                </div>
                <div style={{
                  width: 18, height: 18, border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-bright)'}`,
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {isSelected && <Check size={12} color="var(--bg)" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid var(--border)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setSelected(new Set())} disabled={selected.size === 0} style={{
            background: 'transparent', border: 'none',
            color: selected.size === 0 ? 'var(--text-faint)' : 'var(--text-dim)',
            padding: '6px 0', fontSize: 12, cursor: selected.size === 0 ? 'default' : 'pointer',
          }}>Clear all</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
              padding: '8px 14px', fontSize: 12,
            }}>Cancel</button>
            <button onClick={apply} style={{
              background: 'var(--accent)', border: `1px solid var(--accent)`, color: 'var(--bg)',
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
            }}>Apply</button>
          </div>
        </div>
      </div>
    </>
  );
}

function CopyButton({ value, sm = false }) {
  const [copied, setCopied] = useState(false);
  const handleClick = (e) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }).catch(() => {});
    }
  };
  return (
    <button
      onClick={handleClick}
      title={copied ? 'Copied!' : `Copy: ${value}`}
      className="card-hover"
      style={{
        background: 'transparent', border: 'none',
        padding: sm ? 2 : 4, cursor: 'pointer',
        color: copied ? 'var(--good)' : 'var(--text-faint)',
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
      }}
    >
      {copied ? <Check size={sm ? 11 : 13} /> : <Copy size={sm ? 11 : 13} />}
    </button>
  );
}

function FilterSelect({ value, onChange, options, w = 140 }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--bg)', color: 'var(--text)', border: `1px solid var(--border)`,
          padding: '6px 24px 6px 12px', fontSize: 12,
          fontFamily: 'inherit', appearance: 'none', cursor: 'pointer', minWidth: w,
        }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronRight size={11} color="var(--text-dim)" style={{ position: 'absolute', right: 8, transform: 'rotate(90deg)', pointerEvents: 'none' }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT FILTER — top-level pill row that scopes everything below it to
// findings from a single source/scanner. Sits above the summary band on the
// overview. The filter persists in the URL (?assessment=coverity) and
// propagates through every drill-down.
// ─────────────────────────────────────────────────────────────────────────────
function AssessmentFilter({ assessment, onChange, buckets }) {
  // Total finding count per assessment type — used as a small subtitle on each
  // pill so the user can tell at a glance which sources have the most data.
  const counts = useMemo(() => {
    const m = { all: 0 };
    ASSESSMENT_KEYS.forEach(k => { m[k] = 0; });
    buckets.forEach(b => {
      m.all += b.count;
      ASSESSMENT_KEYS.forEach(k => {
        m[k] += b.count * (b.assessmentMix[k] || 0);
      });
    });
    return m;
  }, [buckets]);

  const Pill = ({ k, label, sub, active, color, Icon }) => (
    <button onClick={() => onChange(k)} className="card-hover" style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
      background: active ? color : 'transparent',
      color:      active ? '#fff' : 'var(--text)',
      border: `1px solid ${active ? color : 'var(--border)'}`,
      fontSize: 12, fontWeight: 500, cursor: 'pointer',
      transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    }}>
      {Icon && <Icon size={13} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
        <span>{label}</span>
        <span className="mono" style={{
          fontSize: 9, fontVariantNumeric: 'tabular-nums',
          color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-dim)',
          letterSpacing: '0.04em',
        }}>{sub}</span>
      </div>
    </button>
  );

  return (
    <div style={{
      padding: '20px 28px 16px', borderBottom: `1px solid var(--border)`,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
        <span className="label" style={{ marginBottom: 2 }}>Assessment Source</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {assessment === 'all' ? 'All scanners — unfiltered' : 'Filtered to one source'}
        </span>
      </div>
      <Pill k="all" label="All sources" sub={`${fmtNum(Math.round(counts.all))} findings`} active={assessment === 'all'} color="var(--accent)" />
      {ASSESSMENT_KEYS.map(k => {
        const t = ASSESSMENT_TYPES[k];
        return <Pill key={k} k={k} label={t.short} sub={`${fmtNum(Math.round(counts[k]))} findings`} active={assessment === k} color={t.color} Icon={t.icon} />;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT CHIP — slim "Filtered to: X ✕" indicator for drill-down pages.
// Renders a single-source pill when one is selected, or a "N sources" chip
// when two or more are selected.
// ─────────────────────────────────────────────────────────────────────────────
function AssessmentChip({ assessment, onClear }) {
  if (!assessment || assessment.size === 0) return null;
  const keys = [...assessment];
  if (keys.length === 1) {
    const t = ASSESSMENT_TYPES[keys[0]];
    if (!t) return null;
    const Icon = t.icon;
    return (
      <div className="card-hover" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 10px',
        background: 'var(--surface-2)', border: `1px solid ${t.color}`, color: t.color,
        fontSize: 11, fontWeight: 500,
      }}>
        <Icon size={11} />
        <span>Filtered: {t.label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onClear && onClear(); }}
          title="Clear assessment filter"
          style={{
            background: 'transparent', border: 'none', color: t.color,
            padding: 0, marginLeft: 4, display: 'flex', alignItems: 'center', cursor: 'pointer',
          }}
        >
          <X size={12} />
        </button>
      </div>
    );
  }
  // 2+ selected — show count and color-stripe
  const colors = keys.map(k => ASSESSMENT_TYPES[k] && ASSESSMENT_TYPES[k].color).filter(Boolean);
  return (
    <div className="card-hover" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      background: 'var(--surface-2)', border: `1px solid var(--accent)`, color: 'var(--accent)',
      fontSize: 11, fontWeight: 500,
    }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {colors.map((c, i) => (
          <span key={i} style={{ width: 6, height: 10, background: c, display: 'inline-block' }} />
        ))}
      </span>
      <span>Filtered: {keys.length} sources</span>
      <button
        onClick={(e) => { e.stopPropagation(); onClear && onClear(); }}
        title="Clear assessment filter"
        style={{
          background: 'transparent', border: 'none', color: 'var(--accent)',
          padding: 0, marginLeft: 4, display: 'flex', alignItems: 'center', cursor: 'pointer',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT TAG — small color-coded type tag used in the findings table
// ─────────────────────────────────────────────────────────────────────────────
function AssessmentTag({ assessment, sm = false }) {
  const t = ASSESSMENT_TYPES[assessment];
  if (!t) return <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span>;
  const Icon = t.icon;
  return (
    <span title={t.label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: sm ? 10 : 11, color: t.color, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={sm ? 10 : 11} />
      {t.short}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERED EMPTY STATE — shown when the assessment filter hides the entire
// page's content (e.g. opening a Coverity-only campaign with the filter set
// to Pentest). The user can clear the filter from here without losing the
// route.
// ─────────────────────────────────────────────────────────────────────────────
function FilteredEmptyState({ kind, label, assessment, onClearAssessment, onBack }) {
  // Build a human label for the active filter set.
  const keys = assessment ? [...assessment] : [];
  const filterLabel = keys.length === 0
    ? 'the active filter'
    : keys.length === 1
      ? (ASSESSMENT_TYPES[keys[0]] ? ASSESSMENT_TYPES[keys[0]].label : keys[0])
      : `the selected ${keys.length} sources`;
  return (
    <div className="fade-in" style={{ padding: '60px 28px', textAlign: 'center' }}>
      <div className="label" style={{ marginBottom: 12, color: 'var(--text-dim)' }}>
        Nothing to show
      </div>
      <h2 className="display" style={{ fontSize: 28, fontWeight: 400, margin: '0 0 12px', color: 'var(--text)' }}>
        This {kind}{label ? ` — ${label}` : ''} has no findings from {filterLabel}.
      </h2>
      <p style={{ color: 'var(--text-dim)', maxWidth: 520, margin: '0 auto 24px', fontSize: 13 }}>
        The assessment filter is hiding everything on this page. Clear it to view the campaign in full, or go back to the operations brief.
      </p>
      <div style={{ display: 'inline-flex', gap: 10 }}>
        <button onClick={onClearAssessment} style={{
          background: 'var(--accent)', color: 'var(--bg)', border: 'none',
          padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>Clear filter</button>
        <button onClick={onBack} style={{
          background: 'transparent', color: 'var(--text)', border: `1px solid var(--border)`,
          padding: '8px 16px', fontSize: 12, cursor: 'pointer',
        }}>Back to overview</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MY CAMPAIGNS TOGGLE — checkbox row above the Effort Map. Filters the
// treemap (only) to campaigns the current user is assigned to. Shows the
// user's avatar + name so it's clear who "you" are. Persisted in URL as
// ?mine=1 alongside theme and assessment.
// ─────────────────────────────────────────────────────────────────────────────
function MyCampaignsToggle({ onlyMine, onChange, currentUser, mineCount, totalCount, rightSlot }) {
  if (!currentUser) return null;
  return (
    <div style={{
      padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14,
      borderTop: `1px solid var(--border)`,
    }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        fontSize: 13, color: 'var(--text)',
      }}>
        <input
          type="checkbox"
          checked={!!onlyMine}
          onChange={(e) => onChange(e.target.checked)}
          style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }}
        />
        <span>Only campaigns I'm assigned to</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Avatar person={currentUser} size={20} />
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{currentUser.name}</span>
        </span>
      </label>
      <span className="mono" style={{
        fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums',
        marginLeft: 4,
      }}>
        {onlyMine ? `${mineCount} of ${totalCount}` : `${totalCount} total`}
      </span>
      {rightSlot && <span style={{ marginLeft: 'auto' }}>{rightSlot}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SEARCH — header search input with live dropdown across assets
// (id, hostname, IP) and campaigns (verb + noun). Click or Enter on a result
// to navigate. Esc dismisses. Index is built once per (world, buckets) pair
// so typing stays snappy across 5K assets.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CREATE CAMPAIGN MODAL — visual-only modal for relaying the concept of
// custom-defined remediation campaigns. No persistence behind it; submit
// just closes. The dropdown of preset types maps to the verbs already used
// in the data model so it composes cleanly if/when this is wired to real
// campaign creation.
// ─────────────────────────────────────────────────────────────────────────────
const CAMPAIGN_TYPE_OPTIONS = [
  { id: 'segment-network',     label: 'Segment Network' },
  { id: 'retire-asset',        label: 'Retire Asset' },
  { id: 'patch-software',      label: 'Patch Software' },
  { id: 'upgrade-software',    label: 'Upgrade Software' },
  { id: 'rotate-credentials',  label: 'Rotate Credentials' },
  { id: 'configure-hardening', label: 'Configure Hardening' },
  { id: 'enable-control',      label: 'Enable Security Control' },
  { id: 'replace-component',   label: 'Replace Component' },
  { id: 'audit-access',        label: 'Audit Access' },
  { id: 'decommission-eol',    label: 'Decommission End-of-Life' },
];

function CreateCampaignModal({ open, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [eta, setEta] = useState('');
  const [comment, setComment] = useState('');

  // Reset fields whenever the modal closes so the next open is clean.
  useEffect(() => {
    if (!open) {
      setName(''); setType(''); setEta(''); setComment('');
    }
  }, [open]);

  // Esc dismisses
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const inputStyle = {
    width: '100%', background: 'var(--bg)', color: 'var(--text)',
    border: `1px solid var(--border)`, padding: '8px 12px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };

  const submit = () => {
    // Visual only — no actual campaign creation. Close the modal.
    onClose();
  };

  return (
    <div onClick={onClose} className="fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: `1px solid var(--border-bright)`,
        padding: 28, width: 560, maxWidth: '100%', maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <div className="label" style={{ marginBottom: 6, color: 'var(--accent)' }}>Create Campaign</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', lineHeight: 1.2 }}>
              Define a new remediation effort.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              A campaign groups findings under a single action. Pick a type, give it a clear name, and add notes for the team.
            </div>
          </div>
          <button onClick={onClose} title="Close" style={{
            background: 'transparent', border: 'none', color: 'var(--text-dim)',
            padding: 4, cursor: 'pointer', display: 'flex', flexShrink: 0,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            Campaign Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Segment Production VPC"
            autoFocus
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            Campaign Type
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: 32 }}
            >
              <option value="">Select a type…</option>
              {CAMPAIGN_TYPE_OPTIONS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <ChevronRight size={11} color="var(--text-dim)" style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none',
            }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            Estimated Completion <span style={{ textTransform: 'none', color: 'var(--text-faint)', letterSpacing: 0, fontWeight: 400 }}>· optional</span>
          </label>
          <input
            type="date"
            value={eta}
            onChange={e => setEta(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            Comments <span style={{ textTransform: 'none', color: 'var(--text-faint)', letterSpacing: 0, fontWeight: 400 }}>· optional</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Context, constraints, rollout notes…"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'transparent', color: 'var(--text)', border: `1px solid var(--border)`,
            padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim() || !type}
            style={{
              background: (!name.trim() || !type) ? 'var(--surface-3)' : 'var(--accent)',
              color: (!name.trim() || !type) ? 'var(--text-faint)' : '#fff',
              border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 600,
              cursor: (!name.trim() || !type) ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={13} /> Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobalSearch({ world, buckets, onJumpAsset, onJumpCampaign }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Flat search index — built once. ~5K asset entries + 25 campaign entries.
  // search field is pre-lowercased so we don't allocate strings per keystroke.
  const index = useMemo(() => {
    const entries = [];
    buckets.forEach(b => {
      const label = `${b.verb} ${b.noun}`;
      entries.push({
        kind: 'campaign', id: b.id,
        label, sub: `${fmtNum(b.count)} findings · ~${fmtNum(b.affectedAssets)} assets`,
        search: label.toLowerCase(),
      });
    });
    world.assets.forEach(a => {
      const m = a.meta || {};
      const sub = [m.hostname, m.ip, a.criticality, a.env, a.team].filter(Boolean).join(' · ');
      const search = `${a.id} ${m.hostname || ''} ${m.ip || ''} ${a.team || ''}`.toLowerCase();
      entries.push({ kind: 'asset', id: a.id, label: a.id, sub, search });
    });
    return entries;
  }, [world, buckets]);

  const results = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    if (qLower.length < 2) return [];
    // Two-pass: prefix matches first, then substring matches. Cap at 12.
    const prefix = [];
    const substr = [];
    for (let i = 0; i < index.length; i++) {
      const e = index[i];
      const pos = e.search.indexOf(qLower);
      if (pos === 0) prefix.push(e);
      else if (pos > 0) substr.push(e);
      if (prefix.length >= 12) break;
    }
    const out = prefix.concat(substr).slice(0, 12);
    // Tie-break: campaigns sort before assets when relevance is equal
    out.sort((a, b) => {
      const aP = a.search.startsWith(qLower) ? 0 : 1;
      const bP = b.search.startsWith(qLower) ? 0 : 1;
      if (aP !== bP) return aP - bP;
      if (a.kind === b.kind) return 0;
      return a.kind === 'campaign' ? -1 : 1;
    });
    return out;
  }, [q, index]);

  // Click outside dismisses dropdown.
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // "/" anywhere on the page focuses the search field. Suppressed if the
  // user is already typing in an input/textarea/contenteditable so it doesn't
  // hijack normal text entry.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (t && t.isContentEditable) return;
      e.preventDefault();
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setHighlight(0); }, [q]);

  const pick = (r) => {
    if (!r) return;
    setQ('');
    setOpen(false);
    if (inputRef.current) inputRef.current.blur();
    if (r.kind === 'campaign') onJumpCampaign(r.id);
    else if (r.kind === 'asset') onJumpAsset(r.id);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length) setHighlight(h => Math.min(results.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (results.length) {
        e.preventDefault();
        pick(results[highlight] || results[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      if (inputRef.current) inputRef.current.blur();
    }
  };

  const KindIcon = ({ kind }) => kind === 'campaign'
    ? <Layers size={12} color="var(--accent)" />
    : <Server size={12} color="var(--text-dim)" />;

  return (
    <div ref={wrapRef} style={{
      position: 'relative', flex: '1 1 320px', minWidth: 220, maxWidth: 460,
      marginLeft: 24, marginRight: 24,
    }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} color="var(--text-dim)" style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
        }} />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search assets, IPs, hostnames, campaigns…"
          style={{
            width: '100%', background: 'var(--surface-2)', color: 'var(--text)',
            border: `1px solid var(--border)`, padding: '7px 28px 7px 30px',
            fontSize: 12, fontFamily: 'inherit', outline: 'none',
          }}
        />
        {q && (
          <button
            onClick={() => { setQ(''); if (inputRef.current) inputRef.current.focus(); }}
            title="Clear"
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        )}
        {!q && (
          <span title="Press / to focus" className="mono" style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'var(--bg)', color: 'var(--text-dim)',
            border: `1px solid var(--border)`,
            padding: '0 5px', fontSize: 10, lineHeight: '14px',
            pointerEvents: 'none', userSelect: 'none',
          }}>/</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: `1px solid var(--border-bright)`,
          maxHeight: 360, overflowY: 'auto', zIndex: 20,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.id}`}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '8px 12px', background: i === highlight ? 'var(--surface-2)' : 'transparent',
                border: 'none', borderBottom: i === results.length - 1 ? 'none' : `1px solid var(--border)`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <KindIcon kind={r.kind} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={r.kind === 'asset' ? 'mono' : ''} style={{
                  fontSize: 12, color: 'var(--text)',
                  fontWeight: r.kind === 'campaign' ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.label}</div>
                <div style={{
                  fontSize: 10, color: 'var(--text-dim)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.sub}</div>
              </div>
              <span className="label" style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                {r.kind}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: `1px solid var(--border)`,
          padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)', zIndex: 20,
        }}>
          No matches for <span style={{ color: 'var(--text)' }}>"{q}"</span>.
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, width = 140, height = 36, color = 'var(--accent)', showEnd = true }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 2;
  const usable = height - pad * 2;
  const pts = data.map((v, i) => [
    i * stepX,
    pad + usable - ((v - min) / range) * usable,
  ]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${width.toFixed(2)},${height.toFixed(2)} L0,${height.toFixed(2)} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path d={areaPath} fill={color} fillOpacity={0.13} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {showEnd && <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />}
    </svg>
  );
}

// SLA badge — red overdue, amber approaching, no badge for OK
function SlaBadge({ status, count, sm = false }) {
  if (!status || (count !== undefined && count === 0)) return null;
  const cfg = {
    overdue: { label: 'Overdue', color: 'var(--sev-critical)', bg: 'rgba(220,38,38,0.08)' },
    approaching: { label: 'Approaching', color: 'var(--sev-high)', bg: 'rgba(234,88,12,0.08)' },
    ok: { label: 'On track', color: 'var(--good)', bg: 'transparent' },
  }[status];
  if (!cfg) return null;
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: sm ? '1px 6px' : '2px 8px',
      fontSize: sm ? 10 : 11, fontWeight: 500,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}`,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {count !== undefined ? `${fmtNum(count)} ` : ''}{cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET METADATA MODAL
// ─────────────────────────────────────────────────────────────────────────────
function MetaRow({ label, value, mono = true, copyValue }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12, padding: '8px 0', borderBottom: `1px solid var(--border)`, alignItems: 'center' }}>
      <div className="label" style={{ fontSize: 10, letterSpacing: '0.1em' }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</div>
      <div>{copyValue && <CopyButton value={copyValue} sm />}</div>
    </div>
  );
}

function AssetMetaModal({ asset, onClose, burndown }) {
  if (!asset) return null;
  const A = ASSET_TYPES[asset.type];
  const C = CRITICALITY[asset.criticality];
  const m = asset.meta;

  // close on escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} className="fade-in" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60,
      }}/>
      <div className="fade-in" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(720px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 48px)',
        background: 'var(--surface)', border: `1px solid var(--border-bright)`,
        zIndex: 61, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <A.Icon size={11} strokeWidth={1.75} /> Asset Metadata
            </div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 8 }}>
              {asset.id}
              <CopyButton value={asset.id} sm />
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <CritBadge tier={asset.criticality} sm />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {A.label} · {asset.env} · team-{asset.team}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4 }}>
            <X size={18}/>
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* burndown */}
          {burndown && (
            <div style={{ marginBottom: 24, padding: 16, border: `1px solid var(--border)`, background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div className="label" style={{ marginBottom: 2 }}>Findings · 90-day trend</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {fmtNum(burndown[0])} → <span style={{ color: 'var(--good)' }}>{fmtNum(burndown[burndown.length - 1])}</span>
                    {' · '}
                    <span style={{ color: 'var(--good)' }}>↓ {Math.round((1 - burndown[burndown.length - 1] / burndown[0]) * 100)}%</span>
                  </div>
                </div>
                <Sparkline data={burndown} width={200} height={40} color="var(--good)" />
              </div>
            </div>
          )}

          {/* sections */}
          <div className="label" style={{ marginBottom: 4, color: 'var(--accent)' }}>Contact</div>
          <MetaRow label="Primary Owner" value={<a href={`mailto:${m.primaryEmail}`}>{m.primaryEmail}</a>} mono={false} copyValue={m.primaryEmail} />
          <MetaRow label="Secondary Owner" value={<a href={`mailto:${m.secondaryEmail}`}>{m.secondaryEmail}</a>} mono={false} copyValue={m.secondaryEmail} />
          <MetaRow label="Slack" value={m.slackChannel} copyValue={m.slackChannel} />
          <MetaRow label="On-call" value={m.pagerDuty} copyValue={m.pagerDuty} />

          <div className="label" style={{ marginTop: 22, marginBottom: 4, color: 'var(--accent)' }}>Infrastructure</div>
          <MetaRow label="Hostname" value={m.hostname} copyValue={m.hostname} />
          <MetaRow label="IP Address" value={m.ip} copyValue={m.ip} />
          <MetaRow label="Region · AZ" value={m.az} />
          <MetaRow label="CMDB ID" value={m.cmdbId} copyValue={m.cmdbId} />
          <MetaRow label="Deployed" value={m.deployedAt} />
          <MetaRow label="Last Modified" value={m.lastModified} />

          {m.tags && m.tags.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 22, marginBottom: 8, color: 'var(--accent)' }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {m.tags.map(t => (
                  <span key={t} className="mono" style={{
                    fontSize: 11, padding: '3px 8px',
                    border: `1px solid var(--border-bright)`,
                    color: 'var(--text-dim)', textTransform: 'lowercase',
                  }}>{t}</span>
                ))}
              </div>
            </>
          )}

          <div className="label" style={{ marginTop: 22, marginBottom: 8, color: 'var(--accent)' }}>Quick Links</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['Runbook', m.runbookUrl],
              ['Monitoring', m.monitoringUrl],
              ['Repo', m.repoUrl],
            ].map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noreferrer" style={{
                fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                border: `1px solid var(--border)`, color: 'var(--text)',
                textDecoration: 'none', background: 'var(--surface-2)',
              }}>
                {label} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid var(--border)`, fontSize: 11, color: 'var(--text-faint)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Press <span className="mono">Esc</span> to close</span>
          <span>Pulled from CMDB · last sync 14 min ago</span>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
function ThemePicker({ theme, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Theme"
        className="card-hover"
        style={{
          background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
          padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
        }}
      >
        <Palette size={13} /> {THEMES[theme]?.label || theme}
      </button>
      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--surface)', border: `1px solid var(--border-bright)`,
          minWidth: 200, zIndex: 30, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          <div className="label" style={{ padding: '10px 14px 6px', fontSize: 9.5 }}>Theme</div>
          {THEME_KEYS.map(key => {
            const t = THEMES[key];
            const v = t.vars;
            const isCurrent = key === theme;
            return (
              <button
                key={key}
                onClick={() => { onSelect(key); setOpen(false); }}
                className="clickable"
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  color: 'var(--text)', textAlign: 'left',
                  borderTop: `1px solid var(--border)`,
                }}
              >
                {/* swatches */}
                <div style={{ display: 'flex', border: `1px solid var(--border)`, flexShrink: 0 }}>
                  <span style={{ width: 14, height: 22, background: v['--bg'] }} />
                  <span style={{ width: 14, height: 22, background: v['--surface-2'] }} />
                  <span style={{ width: 14, height: 22, background: v['--accent'] }} />
                  <span style={{ width: 14, height: 22, background: v['--sev-critical'] }} />
                </div>
                <span style={{ flex: 1, fontSize: 13 }}>{t.label}</span>
                {isCurrent && <Check size={14} color="var(--accent)" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header({ totalFindings, totalHours, theme, onSelectTheme, onSettings, onHome, world, buckets, onJumpAsset, onJumpCampaign, onOpenSources, activeSourcesCount }) {
  return (
    <header style={{
      borderBottom: `1px solid var(--border)`,
      padding: '14px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      gap: 16,
    }}>
      <button onClick={onHome} style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)', flexShrink: 0 }}>
        <Layers size={22} color="var(--accent)" strokeWidth={1.5} />
        <span className="display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.04em' }}>{BRAND.name}</span>
        <span className="label" style={{ marginLeft: 4 }}>{BRAND.tagline}</span>
      </button>
      {world && buckets && (
        <GlobalSearch
          world={world}
          buckets={buckets}
          onJumpAsset={onJumpAsset}
          onJumpCampaign={onJumpCampaign}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <span className="label">Findings</span>{' '}
            <span className="mono" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{fmtNum(totalFindings)}</span>
          </div>
          <div>
            <span className="label">Estimated Effort</span>{' '}
            <span className="mono" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>{fmtHours(totalHours)}</span>
          </div>
        </div>
        <ThemePicker theme={theme} onSelect={onSelectTheme} />
        <button onClick={onOpenSources} className="card-hover" style={{
          background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
          padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
          position: 'relative',
        }}>
          <Filter size={13} /> Sources
          {activeSourcesCount > 0 && (
            <span className="mono" style={{
              background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700,
              padding: '1px 5px', minWidth: 14, textAlign: 'center', letterSpacing: '0.02em',
            }}>{activeSourcesCount}</span>
          )}
        </button>
        <button onClick={onSettings} className="card-hover" style={{
          background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
          padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
        }}>
          <Settings size={13} /> Estimates
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY BAND
// ─────────────────────────────────────────────────────────────────────────────
function SummaryBand({ buckets, totalHours, burndown }) {
  const totalFindings = buckets.reduce((s, b) => s + b.count, 0);
  const criticalCount = buckets.reduce((s, b) => s + b.sevCounts[0], 0);
  const totalAffectedAssets = buckets.reduce((s, b) => s + b.affectedAssets, 0);
  const overdueTotal = buckets.reduce((s, b) => s + b.overdueTotal, 0);
  const days = (totalHours / 8).toFixed(0);
  const burndownDelta = burndown ? Math.round((1 - burndown[burndown.length - 1] / burndown[0]) * 100) : 0;

  return (
    <div style={{
      borderBottom: `1px solid var(--border)`,
      padding: '40px 28px 36px',
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
      gap: 48,
      position: 'relative',
    }} className="grain">
      <div>
        <div className="label" style={{ marginBottom: 14 }}>Operations Brief · Q2</div>
        <h1 className="display" style={{
          fontSize: 36, fontWeight: 400, lineHeight: 1.1, margin: 0,
          color: 'var(--text)',
        }}>
          You have <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>{fmtNum(totalFindings)}</span> findings <br/>
          across <span className="mono" style={{ fontSize: 28, fontWeight: 500, fontStyle: 'normal' }}>~{fmtNum(totalAffectedAssets)}</span> assets.
        </h1>
        {burndown && (
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--surface)', border: `1px solid var(--border)`, maxWidth: 480 }}>
            <Sparkline data={burndown} width={160} height={36} color="var(--good)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="label" style={{ fontSize: 9.5 }}>90-day trend</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                <span className="mono">{fmtNum(burndown[0])}</span>
                {' → '}
                <span className="mono" style={{ color: 'var(--good)', fontWeight: 600 }}>{fmtNum(burndown[burndown.length - 1])}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingDown size={11} /> down {burndownDelta}% in 90 days
              </div>
            </div>
          </div>
        )}
      </div>
      <StatNum value={fmtNum(criticalCount)} label="Critical Severity" accent="var(--sev-critical)" sub={`${((criticalCount/totalFindings)*100).toFixed(1)}% of total`} />
      <StatNum value={fmtHours(totalHours)} label="Estimated Effort" accent="var(--accent)" sub={`~${fmtNum(+days)} person-days`} />
      <StatNum value={fmtNum(overdueTotal)} label="SLA Overdue" accent="var(--sev-critical)" sub={`${((overdueTotal/totalFindings)*100).toFixed(1)}% out of policy`} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LENS CARDS
// ─────────────────────────────────────────────────────────────────────────────
function LensCard({ icon: Icon, title, tagline, items, onPick, accent }) {
  return (
    <div style={{
      border: `1px solid var(--border)`,
      background: 'var(--surface)',
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Icon size={16} color={accent} strokeWidth={1.75} />
        <span className="label" style={{ color: accent, letterSpacing: '0.18em' }}>{title}</span>
      </div>
      <div className="display" style={{ fontSize: 22, fontWeight: 400, marginBottom: 6, color: 'var(--text)', lineHeight: 1.2 }}>{tagline}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, marginTop: 14 }}>
        {items.map((b, i) => (
          <button key={b.id} onClick={() => onPick(b.id)} className="clickable" style={{
            background: 'transparent',
            border: 'none',
            borderTop: i === 0 ? `1px solid var(--border)` : 'none',
            borderBottom: `1px solid var(--border)`,
            padding: '12px 0',
            display: 'grid',
            gridTemplateColumns: '24px 1fr auto',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text)',
            textAlign: 'left',
          }}>
            <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11 }}>{(i + 1).toString().padStart(2, '0')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: 'var(--text-dim)' }}>{b.verb}</span>{' '}{b.noun}
              </div>
              <SeverityBar counts={b.sevCounts} height={3} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{b.metricLabel}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{b.subLabel}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
function LensesRow({ buckets, hoursMap, onPick }) {
  const enriched = buckets.map(b => ({
    ...b, hours: hoursMap[b.id],
    findingsPerHour: b.count / hoursMap[b.id],
    riskPerHour: b.riskScore / hoursMap[b.id],
  }));
  const leverage = [...enriched].sort((a, b) => b.findingsPerHour - a.findingsPerHour).slice(0, 3)
    .map(b => ({ ...b, metricLabel: `${Math.round(b.findingsPerHour)}/hr`, subLabel: `${fmtNum(b.count)} fixes` }));
  const risk = [...enriched].sort((a, b) => b.riskPerHour - a.riskPerHour).slice(0, 3)
    .map(b => ({ ...b, metricLabel: `${Math.round(b.riskPerHour)} risk/hr`, subLabel: `${fmtNum(b.sevCounts[0])} crit` }));
  const policy = [...enriched].sort((a, b) => b.policyPressure - a.policyPressure).slice(0, 3)
    .map(b => ({ ...b, metricLabel: `${fmtNum(b.overdueTotal)} late`, subLabel: `${fmtNum(b.overdueBySev[0])} crit · ${fmtNum(b.overdueBySev[1])} hi` }));
  const quick = [...enriched].sort((a, b) => a.hours - b.hours).slice(0, 3)
    .map(b => ({ ...b, metricLabel: fmtHours(b.hours), subLabel: `${fmtNum(b.count)} fixes` }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: '24px 28px' }}>
      <LensCard icon={Zap} title="Leverage Plays" tagline="One action, many fixes." items={leverage} onPick={onPick} accent="var(--accent)" />
      <LensCard icon={ShieldAlert} title="Risk Crushers" tagline="Highest danger per hour." items={risk} onPick={onPick} accent="var(--sev-critical)" />
      <LensCard icon={AlertCircle} title="Policy Alignment" tagline="Most past SLA." items={policy} onPick={onPick} accent="var(--sev-high)" />
      <LensCard icon={Target} title="Quick Wins" tagline="Smallest end-to-end." items={quick} onPick={onPick} accent="var(--good)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREEMAP
// ─────────────────────────────────────────────────────────────────────────────
function dominantSevIdx(sevCounts) {
  const w = [sevCounts[0] * 3, sevCounts[1] * 2, sevCounts[2] * 1, sevCounts[3] * 0.5];
  let max = 0, idx = 0;
  w.forEach((v, i) => { if (v > max) { max = v; idx = i; } });
  return idx;
}
function TreemapCell(props) {
  const { x, y, width, height, verb, noun, hours, count, sevIdx, id, onPick, theme, assignees } = props;
  if (!width || !height || width < 1 || height < 1) return null;
  const C = cellPalette(theme);
  const sevColor = C.sev[sevIdx ?? 3];
  const sevColorCss = SEV_COLOR[sevIdx ?? 3]; // var(--sev-...) for HTML/CSS context
  const showFull = width > 110 && height > 70;
  const showSmall = width > 60 && height > 40;
  const washOpacity = C.washOpacity;
  const hasAssignees = assignees && assignees.length > 0;
  // shrink avatar size and max count for narrower cells
  const avatarSize = width > 200 ? 22 : width > 140 ? 20 : 18;
  const avatarMax = width > 220 ? 4 : width > 160 ? 3 : 2;
  return (
    <g style={{ cursor: id ? 'pointer' : 'default' }} onClick={() => id && onPick && onPick(id)}>
      <rect x={x} y={y} width={width} height={height} fill={C.surface2} stroke={C.bg} strokeWidth={2} />
      <rect x={x} y={y} width={width} height={height} fill={sevColor} fillOpacity={washOpacity} />
      <rect x={x} y={y} width={6} height={height} fill={sevColor} />
      {/* "unassigned" left-edge dim if no one is on it — same width as severity strip but desaturated.
          Only on the bottom half so it doesn't fight the severity strip visually. */}
      {!hasAssignees && showSmall && (
        <rect x={x + 6} y={y + height - 3} width={width - 6} height={3} fill={C.textDim} fillOpacity={0.2} />
      )}
      {showSmall && (
        <foreignObject x={x + 18} y={y + 14} width={Math.max(0, width - 36)} height={Math.max(0, height - 28)}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            overflow: 'hidden',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            <div style={{ minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {showFull && (
                  <div style={{
                    color: sevColorCss,
                    fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.16em',
                    marginBottom: 8, lineHeight: 1,
                  }}>{verb}</div>
                )}
                <div style={{
                  color: 'var(--text)',
                  fontSize: showFull ? 18 : 13,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}>{noun}</div>
              </div>
              {hasAssignees && (
                <div style={{ flexShrink: 0, marginTop: showFull ? -2 : 0 }}>
                  <AvatarStack people={assignees} size={avatarSize} max={avatarMax} />
                </div>
              )}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', gap: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              minWidth: 0,
            }}>
              {showFull ? (
                <>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {fmtNum(count)} <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>findings</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                    {fmtHours(hours)}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {fmtHours(hours)}
                </div>
              )}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}
function CampaignTreemap({ buckets, hoursMap, onPick, theme, assignmentsByBucket }) {
  const data = buckets.map(b => ({
    name: `${b.verb} ${b.noun}`,
    size: hoursMap[b.id],
    verb: b.verb, noun: b.noun, hours: hoursMap[b.id], count: b.count,
    sevIdx: dominantSevIdx(b.sevCounts), id: b.id,
    assignees: assignmentsByBucket ? assignmentsByBucket(b.id) : [],
  }));
  const C = cellPalette(theme);
  return (
    <div style={{ padding: '0 28px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 24 }}>
        <div>
          <div className="label" style={{ marginBottom: 8, color: 'var(--accent)' }}>Effort Map</div>
          <div className="display" style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)', lineHeight: 1.15 }}>
            All campaigns, sized by where your time goes.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
            Click any cell to drill in. Color shows dominant severity; the strip on the left edge encodes it explicitly.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexShrink: 0 }}>
          {SEV.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: SEV_COLOR[i] }} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 520, border: `1px solid var(--border)`, background: 'var(--bg)' }}>
        {data.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)', fontSize: 13, padding: 24, textAlign: 'center',
          }}>
            No campaigns match the current filters. Clear "Only my campaigns" or change the assessment source above to see more.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={data} dataKey="size" stroke={C.bg} isAnimationActive={false} content={<TreemapCell onPick={onPick} theme={theme} />}>
              <Tooltip cursor={false} content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const d = payload[0].payload;
                if (!d || !d.verb) return null;
                return (
                  <div style={{ background: 'var(--surface)', border: `1px solid var(--border-bright)`, padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      <span style={{ color: 'var(--text-dim)' }}>{d.verb}</span> {d.noun}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {fmtNum(d.count)} findings · {fmtHours(d.hours)}
                    </div>
                  </div>
                );
              }}/>
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLIER TOOLTIPS — explain the ×N values in breakdown panels
// ─────────────────────────────────────────────────────────────────────────────
const MULT_TIP_ASSET = {
  server:    'Server: baseline (×1.0). All other asset types are scaled relative to this.',
  database:  'Database (×1.45): replication checks, coordination, and rollback rigor add ~45%.',
  app:       'Application (×1.10): test sweep and dependency revalidation add ~10%.',
  container: 'Container (×0.65): re-deployable from image, ~35% faster than baseline.',
};
const MULT_TIP_ENV = {
  Production:  'Production (×1.5): change windows, approvals, and post-deploy validation add 50%.',
  Staging:     'Staging (×1.0): baseline environment for effort estimates.',
  Development: 'Development (×0.7): fewer guardrails, ~30% faster than staging.',
};
const MULT_TIP_CRIT = {
  T1: 'Crown Jewel (×1.6): heavier validation, customer-comm, and rollback drills add ~60%.',
  T2: 'Important (×1.2): elevated review and notification add ~20% over standard.',
  T3: 'Standard (×0.85): light-touch change, ~15% faster than the policy default.',
};

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN ROW (used in bucket detail and asset detail)
// ─────────────────────────────────────────────────────────────────────────────
function BreakdownRow({ label, sub, subTip, value, total, color, valueLabel }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 60px', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {sub && (
          <span
            title={subTip}
            style={{
              color: 'var(--text-faint)',
              fontSize: 10,
              ...(subTip ? { borderBottom: '1px dotted var(--text-faint)', cursor: 'help' } : null),
            }}
          >
            {sub}
          </span>
        )}
      </span>
      <div style={{ height: 6, background: 'var(--surface-3)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(value / total) * 100}%`, background: color }} />
      </div>
      <span className="mono" style={{ textAlign: 'right', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{valueLabel}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUCKET DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function BucketDetail({ bucket, hours, onBack, onAsset, estimates, setEstimates, world, onAssetMeta, burndown, assignedPeople, onOpenPicker, onFindings, assessment, onClearAssessment, currentUser, isClaimed, onToggleClaim }) {
  const [filterAsset, setFilterAsset] = useState('all');
  const [filterEnv, setFilterEnv] = useState('all');
  const [filterCrit, setFilterCrit] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [sortBy, setSortBy] = useState('severity');

  const entries = world.bucketAssets.get(bucket.id) || [];
  const enriched = useMemo(() => entries.map(e => ({ ...e, asset: world.assetMap.get(e.assetId) })).filter(e => e.asset), [entries, world.assetMap]);

  // unique teams present in this campaign — for the team filter dropdown
  const teamsInBucket = useMemo(() => {
    const set = new Set();
    enriched.forEach(e => set.add(e.asset.team));
    return Array.from(set).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    let out = enriched;
    if (filterAsset !== 'all') out = out.filter(a => a.asset.type === filterAsset);
    if (filterEnv !== 'all') out = out.filter(a => a.asset.env === filterEnv);
    if (filterCrit !== 'all') out = out.filter(a => a.asset.criticality === filterCrit);
    if (filterTeam !== 'all') out = out.filter(a => a.asset.team === filterTeam);
    if (sortBy === 'severity') out = [...out].sort((a, b) => a.worstSeverity - b.worstSeverity || b.findingsCount - a.findingsCount);
    else if (sortBy === 'findings') out = [...out].sort((a, b) => b.findingsCount - a.findingsCount);
    else if (sortBy === 'crit') out = [...out].sort((a, b) => CRIT_KEYS.indexOf(a.asset.criticality) - CRIT_KEYS.indexOf(b.asset.criticality));
    else if (sortBy === 'env') out = [...out].sort((a, b) => a.asset.env.localeCompare(b.asset.env));
    else if (sortBy === 'age') out = [...out].sort((a, b) => b.oldestAge - a.oldestAge);
    return out;
  }, [enriched, filterAsset, filterEnv, filterCrit, filterTeam, sortBy]);

  const baseHours = estimates[bucket.id] ?? bucket.baseHours;

  // criticality breakdown across affected assets
  const critBreakdown = useMemo(() => {
    const c = { T1: 0, T2: 0, T3: 0 };
    enriched.forEach(e => { c[e.asset.criticality] += 1; });
    return c;
  }, [enriched]);

  const envBreakdown = ENV_MIX.map(([env, p]) => ({
    env,
    affected: Math.round(bucket.affectedAssets * p),
    hours: Math.round(bucket.affectedAssets * p * baseHours * ENV_MULT[env] * avgCritMult(env)),
  }));

  return (
    <div className="fade-in">
      {/* breadcrumb */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <ArrowLeft size={14} /> Operations Brief
        </button>
        <ChevronRight size={12} color="var(--text-faint)" />
        <span className="label" style={{ color: 'var(--text)' }}>Campaign</span>
        <div style={{ marginLeft: 'auto' }}>
          <AssessmentChip assessment={assessment} onClear={onClearAssessment} />
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: '32px 28px 28px', borderBottom: `1px solid var(--border)`, position: 'relative' }} className="grain">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, alignItems: 'end' }}>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Campaign · {bucket.verb}</div>
            <h1 className="display" style={{ fontSize: 56, fontWeight: 400, margin: 0, lineHeight: 1, color: 'var(--text)' }}>{bucket.noun}</h1>
            <p style={{ color: 'var(--text-dim)', marginTop: 14, maxWidth: 520, fontSize: 13 }}>
              {fmtNum(bucket.count)} findings spread across approximately {fmtNum(bucket.affectedAssets)} assets.
              Effort scales with asset class, environment, and business criticality.
            </p>
          </div>
          <StatNum value={fmtNum(bucket.count)} label="Findings" sub={`~${fmtNum(bucket.affectedAssets)} unique assets`} />
          <StatNum value={fmtHours(hours)} label="Estimated Effort" accent="var(--accent)" sub={fmtHoursDetail(hours)} />
          <StatNum value={fmtNum(Math.round(bucket.riskScore))} label="Risk Score" accent="var(--sev-critical)" sub="severity-weighted" />
        </div>
      </div>

      {/* assignment strip */}
      <div style={{
        padding: '18px 28px', borderBottom: `1px solid var(--border)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{ flexShrink: 0 }}>
            <div className="label" style={{ marginBottom: 4 }}>Assigned to</div>
            {assignedPeople && assignedPeople.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AvatarStack people={assignedPeople} size={32} max={6} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {assignedPeople.length} {assignedPeople.length === 1 ? 'person' : 'people'}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                Unassigned — nobody is currently working this campaign
              </div>
            )}
          </div>
          {assignedPeople && assignedPeople.length > 0 && (
            <div style={{
              paddingLeft: 16, marginLeft: 4,
              borderLeft: `1px solid var(--border)`,
              display: 'flex', flexDirection: 'column', gap: 2,
              fontSize: 11, color: 'var(--text-dim)', minWidth: 0,
            }}>
              {assignedPeople.slice(0, 3).map(p => (
                <span key={p.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ color: 'var(--text-faint)' }}> · {p.role} · team-{p.team}</span>
                </span>
              ))}
              {assignedPeople.length > 3 && (
                <span style={{ color: 'var(--text-faint)' }}>+ {assignedPeople.length - 3} more</span>
              )}
            </div>
          )}
        </div>
        <button onClick={() => onOpenPicker && onOpenPicker(bucket.id)} className="card-hover" style={{
          background: assignedPeople && assignedPeople.length > 0 ? 'transparent' : 'var(--accent)',
          color: assignedPeople && assignedPeople.length > 0 ? 'var(--text)' : 'var(--bg)',
          border: `1px solid ${assignedPeople && assignedPeople.length > 0 ? 'var(--border)' : 'var(--accent)'}`,
          padding: '8px 14px', fontSize: 12, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          {assignedPeople && assignedPeople.length > 0 ? <><Users size={13} /> Manage assignees</> : <><UserPlus size={13} /> Assign people</>}
        </button>
      </div>

      {/* policy + burndown strip */}
      <div style={{
        padding: '20px 28px', borderBottom: `1px solid var(--border)`,
        background: 'var(--surface)', display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center',
      }}>
        <div>
          <div className="label" style={{ marginBottom: 4, color: 'var(--sev-critical)' }}>SLA · Policy Status</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div className="display" style={{ fontSize: 36, color: 'var(--sev-critical)', fontWeight: 500, lineHeight: 1 }}>
              {fmtNum(bucket.overdueTotal)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              overdue
              <span style={{ color: 'var(--sev-high)', marginLeft: 12 }}>+ {fmtNum(bucket.approachingTotal)} approaching</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {SEV.map((s, i) => bucket.overdueBySev[i] > 0 && (
              <span key={s} className="mono" style={{
                fontSize: 10, padding: '2px 8px',
                color: SEV_COLOR[i], border: `1px solid ${SEV_COLOR[i]}`,
                letterSpacing: '0.04em',
              }}>
                {fmtNum(bucket.overdueBySev[i])} {s.toLowerCase()} late
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 360 }}>
          Policy targets: critical 3d · high 90d · medium 180d · low 360d.
          Findings past these thresholds count as overdue.
        </div>
        {burndown && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div className="label" style={{ fontSize: 9.5 }}>90-day trend</div>
            <Sparkline data={burndown} width={200} height={42} color="var(--good)" />
            <div style={{ fontSize: 11, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingDown size={11} /> {Math.round((1 - burndown[burndown.length - 1] / burndown[0]) * 100)}% closed
            </div>
          </div>
        )}
      </div>

      {/* breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, borderBottom: `1px solid var(--border)` }}>
        <div style={{ padding: 24, borderRight: `1px solid var(--border)` }}>
          <div className="label" style={{ marginBottom: 14 }}>By Severity</div>
          {SEV.map((s, i) => (
            <BreakdownRow key={s}
              label={<><span style={{ width: 6, height: 6, background: SEV_COLOR[i], display: 'inline-block', marginRight: 8 }} />{s}</>}
              value={bucket.sevCounts[i]} total={bucket.count} color={SEV_COLOR[i]}
              valueLabel={fmtNum(bucket.sevCounts[i])}
            />
          ))}
        </div>
        <div style={{ padding: 24, borderRight: `1px solid var(--border)` }}>
          <div className="label" style={{ marginBottom: 14 }}>By Asset Class</div>
          {ASSET_TYPE_KEYS.map((k, i) => {
            const A = ASSET_TYPES[k];
            const c = bucket.affectedAssetsByType[i];
            if (!c) return null;
            return (
              <BreakdownRow key={k}
                label={<><A.Icon size={11} color="var(--text-dim)" strokeWidth={1.75} style={{ marginRight: 8, verticalAlign: '-1px' }} />{A.label}</>}
                sub={`×${A.multiplier}`}
                subTip={MULT_TIP_ASSET[k]}
                value={c} total={bucket.affectedAssets} color="var(--accent-2)"
                valueLabel={fmtNum(c)}
              />
            );
          })}
        </div>
        <div style={{ padding: 24, borderRight: `1px solid var(--border)` }}>
          <div className="label" style={{ marginBottom: 14 }}>By Criticality</div>
          {CRIT_KEYS.map(k => {
            const c = critBreakdown[k];
            const total = enriched.length || 1;
            const C = CRITICALITY[k];
            const Icon = C.icon;
            return (
              <BreakdownRow key={k}
                label={<><Icon size={11} color={C.color} strokeWidth={2} style={{ marginRight: 8, verticalAlign: '-1px' }} />{C.label}</>}
                sub={`×${C.multiplier}`}
                subTip={MULT_TIP_CRIT[k]}
                value={c} total={total} color={C.color}
                valueLabel={fmtNum(c)}
              />
            );
          })}
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 10 }}>From {fmtNum(enriched.length)} sampled affected assets.</div>
        </div>
        <div style={{ padding: 24 }}>
          <div className="label" style={{ marginBottom: 14 }}>By Environment</div>
          {envBreakdown.map(({ env, affected, hours }) => (
            <BreakdownRow key={env}
              label={env} sub={`×${ENV_MULT[env]}`}
              subTip={MULT_TIP_ENV[env]}
              value={affected} total={bucket.affectedAssets} color="var(--accent)"
              valueLabel={fmtHours(hours)}
            />
          ))}
        </div>
      </div>

      {/* baseline editor inline */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 24, background: 'var(--surface)' }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Baseline estimate</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Hours to {bucket.verb.toLowerCase()} {bucket.noun} on a typical staging asset (T2 important).</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number" step="0.25" min="0" value={baseHours}
            onChange={e => setEstimates({ ...estimates, [bucket.id]: parseFloat(e.target.value) || 0 })}
            className="mono"
            style={{
              background: 'var(--bg)', border: `1px solid var(--border)`, color: 'var(--text)',
              padding: '8px 12px', fontSize: 14, width: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
            }}
          />
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>hours</span>
          {estimates[bucket.id] !== undefined && estimates[bucket.id] !== bucket.baseHours && (
            <button onClick={() => { const n = { ...estimates }; delete n[bucket.id]; setEstimates(n); }} style={{
              background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <RotateCcw size={11} /> reset to {bucket.baseHours}h
            </button>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div className="label">Campaign total</div>
          <div className="mono display" style={{ fontSize: 22, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(hours)}</div>
        </div>
      </div>

      {/* asset list */}
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Affected Assets</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Showing {fmtNum(filtered.length)} of {fmtNum(enriched.length)} sampled · click any row to drill in
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={onFindings} className="card-hover" style={{
              background: 'transparent', border: `1px solid var(--border-bright)`, color: 'var(--text)',
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <ListChecks size={13} /> View findings
            </button>
            <FilterSelect value={filterAsset} onChange={setFilterAsset} options={[['all', 'All Asset Classes'], ...ASSET_TYPE_KEYS.map(k => [k, ASSET_TYPES[k].label])]} />
            <FilterSelect value={filterEnv} onChange={setFilterEnv} options={[['all', 'All Environments'], ...ENV_MIX.map(([e]) => [e, e])]} />
            <FilterSelect value={filterCrit} onChange={setFilterCrit} options={[['all', 'All Tiers'], ...CRIT_KEYS.map(k => [k, `${CRITICALITY[k].short} · ${CRITICALITY[k].label}`])]} />
            <FilterSelect value={filterTeam} onChange={setFilterTeam} options={[['all', 'All Teams'], ...teamsInBucket.map(t => [t, `team-${t}`])]} />
            <FilterSelect value={sortBy} onChange={setSortBy} options={[
              ['severity', 'Sort: Severity'],
              ['findings', 'Sort: Finding Count'],
              ['crit', 'Sort: Criticality'],
              ['env', 'Sort: Environment'],
              ['age', 'Sort: Oldest First'],
            ]} />
          </div>
        </div>
        <div style={{ border: `1px solid var(--border)` }}>
          <div className="label" style={{
            display: 'grid', gridTemplateColumns: '20px 1.5fr 90px 100px 65px 55px 60px 110px 1fr',
            gap: 14, padding: '10px 16px', borderBottom: `1px solid var(--border)`,
            background: 'var(--surface)',
          }}>
            <span></span><span>Asset</span><span>Class</span><span>Environment</span><span>Tier</span><span>Findings</span><span>Oldest</span><span>SLA</span><span>Latest CVE</span>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}>No assets match the current filters.</div>
                <button
                  onClick={() => { setFilterAsset('all'); setFilterEnv('all'); setFilterCrit('all'); setFilterTeam('all'); }}
                  style={{
                    background: 'transparent', border: `1px solid var(--border)`,
                    color: 'var(--text)', padding: '6px 12px', fontSize: 12,
                  }}
                >Reset filters</button>
              </div>
            )}
            {filtered.slice(0, 150).map((a, i) => {
              const A = ASSET_TYPES[a.asset.type];
              const slaState = a.overdueTotal > 0 ? 'overdue' : a.approachingTotal > 0 ? 'approaching' : null;
              return (
                <div key={a.assetId} onClick={() => onAsset(a.assetId)} style={{
                  display: 'grid', gridTemplateColumns: '20px 1.5fr 90px 100px 65px 55px 60px 110px 1fr',
                  gap: 14, padding: '10px 16px',
                  borderBottom: i < Math.min(filtered.length, 150) - 1 ? `1px solid var(--border)` : 'none',
                  fontSize: 12, alignItems: 'center',
                }} className="clickable">
                  <SevDot sev={a.worstSeverity} size={6} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}>
                    <span className="mono" style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset.id}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAssetMeta && onAssetMeta(a.assetId); }}
                      title="Asset metadata"
                      style={{ background: 'transparent', border: 'none', padding: 2, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Info size={12} />
                    </button>
                    <span style={{ marginLeft: 'auto' }}>
                      <ClaimButton
                        claimed={isClaimed && isClaimed(bucket.id, a.assetId)}
                        onToggle={() => onToggleClaim && onToggleClaim(bucket.id, a.assetId)}
                        currentUser={currentUser}
                        sm
                      />
                    </span>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
                    <A.Icon size={11} strokeWidth={1.75} /> {A.label}
                  </span>
                  <span style={{ color: a.asset.env === 'Production' ? 'var(--text)' : 'var(--text-dim)', fontSize: 11 }}>{a.asset.env}</span>
                  <CritBadge tier={a.asset.criticality} sm />
                  <span className="mono" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{a.findingsCount}</span>
                  <span className="mono" style={{ color: a.oldestAge > SLA_DAYS[a.worstSeverity] ? 'var(--sev-critical)' : 'var(--text-dim)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                    {a.oldestAge}d
                  </span>
                  <span>
                    {slaState
                      ? <SlaBadge status={slaState} count={a.overdueTotal || a.approachingTotal} sm />
                      : <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span>}
                  </span>
                  <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.cve}</span>
                </div>
              );
            })}
          </div>
        </div>
        {filtered.length > 150 && (
          <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', borderLeft: `1px solid var(--border)`, borderRight: `1px solid var(--border)`, borderBottom: `1px solid var(--border)` }}>
            + {fmtNum(filtered.length - 150)} more · in production this list would virtualize
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET DETAIL — third level
// ─────────────────────────────────────────────────────────────────────────────
function AssetDetail({ assetId, fromBucketId, world, buckets, estimates, onBack, onCampaign, onAsset, onAssetMeta, burndown, onFindings, assessment, onClearAssessment, currentUser, isClaimed, onToggleClaim }) {
  const asset = world.assetMap.get(assetId);
  const entries = world.assetFindings.get(assetId) || [];

  if (!asset) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }} className="fade-in">
        <div className="display" style={{ fontSize: 28 }}>Asset not found</div>
        <div style={{ color: 'var(--text-dim)', marginTop: 8, fontSize: 13 }}>{assetId}</div>
        <button onClick={onBack} style={{
          marginTop: 20, background: 'var(--surface-3)', border: `1px solid var(--border-bright)`,
          color: 'var(--text)', padding: '8px 14px', fontSize: 12,
        }}>← Back</button>
      </div>
    );
  }

  const A = ASSET_TYPES[asset.type];
  const C = CRITICALITY[asset.criticality];

  // aggregate stats across all entries
  const totalFindings = entries.reduce((s, e) => s + e.findingsCount, 0);
  const totalSev = [0, 0, 0, 0];
  entries.forEach(e => e.sevCounts.forEach((c, i) => totalSev[i] += c));
  const overdueTotal = entries.reduce((s, e) => s + e.overdueTotal, 0);
  const approachingTotal = entries.reduce((s, e) => s + e.approachingTotal, 0);
  const oldestAge = entries.reduce((m, e) => Math.max(m, e.oldestAge), 0);
  const worstSev = totalSev.findIndex(c => c > 0);
  const totalHrs = assetHours(asset, entries, buckets, estimates);

  // sort entries by severity then hours
  const sorted = [...entries].map(e => {
    const b = buckets.find(x => x.id === e.bucketId);
    const base = estimates[b.id] ?? b.baseHours;
    const hrs = base * A.multiplier * ENV_MULT[asset.env] * C.multiplier;
    return { ...e, bucket: b, hrs };
  }).sort((a, b) => a.worstSeverity - b.worstSeverity || b.hrs - a.hrs);

  const fromBucket = fromBucketId ? buckets.find(b => b.id === fromBucketId) : null;

  return (
    <div className="fade-in">
      {/* breadcrumb */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <ArrowLeft size={14} /> Operations Brief
        </button>
        {fromBucket && (
          <>
            <ChevronRight size={12} color="var(--text-faint)" />
            <button onClick={() => onCampaign(fromBucket.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 12 }}>
              {fromBucket.verb} {fromBucket.noun}
            </button>
          </>
        )}
        <ChevronRight size={12} color="var(--text-faint)" />
        <span className="label" style={{ color: 'var(--text)' }}>Asset</span>
        <div style={{ marginLeft: 'auto' }}>
          <AssessmentChip assessment={assessment} onClear={onClearAssessment} />
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: '32px 28px 28px', borderBottom: `1px solid var(--border)`, position: 'relative' }} className="grain">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, alignItems: 'end' }}>
          <div>
            <div className="label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <A.Icon size={11} strokeWidth={1.75} /> {A.label}
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              {asset.env}
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={10} /> team-{asset.team}</span>
            </div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, lineHeight: 1.05 }}>
              <span className="mono" style={{
                fontSize: 36, fontWeight: 500, color: 'var(--text)',
                wordBreak: 'break-all',
              }}>{asset.id}</span>
              <CopyButton value={asset.id} />
            </h1>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <CritBadge tier={asset.criticality} />
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                Multipliers:{' '}
                <span title={MULT_TIP_ASSET[asset.type]} style={{ borderBottom: '1px dotted var(--text-faint)', cursor: 'help' }}>asset ×{A.multiplier}</span>
                {' · '}
                <span title={MULT_TIP_ENV[asset.env]} style={{ borderBottom: '1px dotted var(--text-faint)', cursor: 'help' }}>env ×{ENV_MULT[asset.env]}</span>
                {' · '}
                <span title={MULT_TIP_CRIT[asset.criticality]} style={{ borderBottom: '1px dotted var(--text-faint)', cursor: 'help' }}>tier ×{C.multiplier}</span>
                <span style={{ color: 'var(--text-faint)' }}> = ×{(A.multiplier * ENV_MULT[asset.env] * C.multiplier).toFixed(2)}</span>
              </span>
              <button onClick={() => onAssetMeta && onAssetMeta(assetId)} className="card-hover" style={{
                marginLeft: 'auto',
                background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
                padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Info size={13} /> View metadata
              </button>
            </div>
          </div>
          <StatNum value={fmtNum(totalFindings)} label="Total Findings" sub={`across ${entries.length} campaign${entries.length === 1 ? '' : 's'}`} />
          <StatNum value={fmtHours(totalHrs)} label="Estimated Effort" accent="var(--accent)" sub={fmtHoursDetail(totalHrs)} />
          <StatNum value={fmtNum(totalSev[0])} label="Critical Findings" accent="var(--sev-critical)" sub={`${fmtNum(totalSev[1])} high · ${fmtNum(totalSev[2])} medium`} />
        </div>
      </div>

      {/* SLA + burndown strip */}
      <div style={{
        padding: '20px 28px', borderBottom: `1px solid var(--border)`,
        background: 'var(--surface)', display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center',
      }}>
        <div>
          <div className="label" style={{ marginBottom: 4, color: overdueTotal > 0 ? 'var(--sev-critical)' : 'var(--good)' }}>SLA · Policy Status</div>
          {overdueTotal > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div className="display" style={{ fontSize: 32, color: 'var(--sev-critical)', fontWeight: 500, lineHeight: 1 }}>
                {fmtNum(overdueTotal)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                overdue
                {approachingTotal > 0 && <span style={{ color: 'var(--sev-high)', marginLeft: 12 }}>+ {fmtNum(approachingTotal)} approaching</span>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div className="display" style={{ fontSize: 28, color: 'var(--good)', fontWeight: 500, lineHeight: 1 }}>
                On track
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {approachingTotal > 0 ? `${fmtNum(approachingTotal)} approaching SLA` : 'all findings within policy'}
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
            Oldest open finding: <span className="mono" style={{ color: 'var(--text-dim)' }}>{oldestAge}d</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 360 }}>
          For {C.label.toLowerCase()} assets, Overdue findings escalate automatically to {asset.criticality === 'T1' ? 'P1 on-call' : 'team lead'} within 24 hours.
        </div>
        {burndown && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div className="label" style={{ fontSize: 9.5 }}>This asset · 90-day trend</div>
            <Sparkline data={burndown} width={200} height={42} color="var(--good)" />
            <div style={{ fontSize: 11, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingDown size={11} /> {Math.round((1 - burndown[burndown.length - 1] / burndown[0]) * 100)}% closed
            </div>
          </div>
        )}
      </div>

      {/* combined window callout */}
      <div style={{
        padding: '20px 28px', borderBottom: `1px solid var(--border)`,
        background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{ width: 36, height: 36, border: `1px solid var(--border-bright)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Wrench size={16} color="var(--accent)" strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>While you're touching this asset</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            Bundling these {entries.length} campaigns into one change window saves change-management overhead and reduces
            customer-visible disruption — especially valuable for {C.label.toLowerCase()} assets.
          </div>
        </div>
        <button style={{
          background: 'var(--accent)', border: `1px solid var(--accent)`, color: 'var(--bg)',
          padding: '8px 14px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Calendar size={12} /> Plan change window
        </button>
      </div>

      {/* campaigns affecting this asset */}
      <div style={{ padding: '28px 28px' }}>
        <div className="label" style={{ marginBottom: 4 }}>Campaigns affecting this asset</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          Sorted by severity, then by hours. Click any campaign to see all assets it touches, or open this asset's findings within that campaign.
        </div>
        <div style={{ border: `1px solid var(--border)` }}>
          <div className="label" style={{
            display: 'grid', gridTemplateColumns: '24px 1.6fr 80px 1fr 100px 110px 80px',
            gap: 16, padding: '10px 16px', borderBottom: `1px solid var(--border)`,
            background: 'var(--surface)',
          }}>
            <span></span><span>Campaign</span><span>Findings</span><span>Severity Mix</span><span>Latest CVE</span><span></span><span style={{ textAlign: 'right' }}>Hours</span>
          </div>
          {sorted.map((e, i) => (
            <div key={e.bucketId} onClick={() => onCampaign(e.bucketId)} className="clickable" style={{
              display: 'grid', gridTemplateColumns: '24px 1.6fr 80px 1fr 100px 110px 80px',
              gap: 16, padding: '12px 16px',
              borderBottom: i < sorted.length - 1 ? `1px solid var(--border)` : 'none',
              fontSize: 12, alignItems: 'center',
            }}>
              <SevDot sev={e.worstSeverity} size={7} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                    <span style={{ color: 'var(--text-dim)' }}>{e.bucket.verb}</span> {e.bucket.noun}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                    base {(estimates[e.bucket.id] ?? e.bucket.baseHours)}h
                  </div>
                </div>
                <span style={{ marginLeft: 'auto' }}>
                  <ClaimButton
                    claimed={isClaimed && isClaimed(e.bucketId, assetId)}
                    onToggle={() => onToggleClaim && onToggleClaim(e.bucketId, assetId)}
                    currentUser={currentUser}
                    sm
                  />
                </span>
              </div>
              <span className="mono" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{e.findingsCount}</span>
              <SeverityBar counts={e.sevCounts} height={5} />
              <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>{e.cve}</span>
              <button
                onClick={(ev) => { ev.stopPropagation(); onFindings && onFindings(e.bucketId); }}
                title="View findings on this asset within this campaign"
                style={{
                  background: 'transparent', border: `1px solid var(--border)`,
                  color: 'var(--text-dim)', padding: '4px 8px', fontSize: 11,
                  display: 'inline-flex', alignItems: 'center', gap: 4, justifySelf: 'end',
                }}
              >
                <List size={11} /> Findings
              </button>
              <span className="mono" style={{ color: 'var(--accent)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtHours(e.hrs)}</span>
            </div>
          ))}
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 1.6fr 80px 1fr 100px 110px 80px',
            gap: 16, padding: '12px 16px',
            borderTop: `2px solid var(--border-bright)`,
            background: 'var(--surface-2)', fontSize: 12,
          }}>
            <span></span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>Total for this asset</span>
            <span className="mono" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtNum(totalFindings)}</span>
            <SeverityBar counts={totalSev} height={5} />
            <span></span>
            <span></span>
            <span className="mono display" style={{ color: 'var(--accent)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{fmtHours(totalHrs)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDINGS VIEW — fourth level. Per-campaign or per-(asset×campaign).
// ─────────────────────────────────────────────────────────────────────────────
const FINDINGS_RENDER_CAP = 800;

// Small Yes/No pill used for KEV and POC columns. "Yes" is loud, "No" is quiet.
function YesNoBadge({ on, tone = 'critical' }) {
  if (on) {
    const color = tone === 'critical' ? 'var(--sev-critical)' : 'var(--sev-high)';
    const bg    = tone === 'critical' ? 'rgba(220,38,38,0.10)' : 'rgba(234,88,12,0.10)';
    return (
      <span className="mono" style={{
        display: 'inline-block', padding: '1px 7px', fontSize: 10, fontWeight: 600,
        color, background: bg, border: `1px solid ${color}`,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>Yes</span>
    );
  }
  return <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.05em' }}>no</span>;
}

// Workflow status tag for the Status column.
function StatusTag({ status }) {
  const map = {
    'Open':           { color: 'var(--text)',      bg: 'transparent',                border: 'var(--border)' },
    'In Progress':    { color: 'var(--accent)',    bg: 'rgba(180,120,40,0.08)',      border: 'var(--accent)' },
    'Risk Accepted':  { color: 'var(--sev-high)',  bg: 'transparent',                border: 'var(--sev-high)' },
    'Fixed':          { color: 'var(--good)',      bg: 'rgba(22,163,74,0.08)',       border: 'var(--good)' },
    'False Positive': { color: 'var(--text-faint)',bg: 'transparent',                border: 'var(--border)' },
  };
  const cfg = map[status] || map['Open'];
  return (
    <span className="mono" style={{
      display: 'inline-block', padding: '1px 6px', fontSize: 10, fontWeight: 500,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{status}</span>
  );
}

// Color-grade priority score: red >= 3000, orange >= 2000, accent >= 1000, dim below.
function priorityColor(score) {
  if (score >= 3000) return 'var(--sev-critical)';
  if (score >= 2000) return 'var(--sev-high)';
  if (score >= 1000) return 'var(--accent)';
  return 'var(--text-dim)';
}

function FindingsView({ bucket, asset, world, onBack, onCampaign, onAsset, onAssetMeta, assessment, onClearAssessment }) {
  // Build the underlying findings list once per (bucket, asset) scope. The
  // global assessment filter is applied here at the per-finding level (each
  // finding has a `.assessment` derived from its campaign's mix).
  const findings = useMemo(() => {
    if (!bucket) return [];
    const entries = world.bucketAssets.get(bucket.id) || [];
    const scoped = asset ? entries.filter(e => e.assetId === asset.id) : entries;
    const all = [];
    scoped.forEach(e => {
      const a = world.assetMap.get(e.assetId);
      if (!a) return;
      const fs = materializeFindings(e, a, bucket);
      fs.forEach(f => all.push({ ...f, asset: a }));
    });
    if (assessment && assessment.size > 0) {
      return all.filter(f => assessment.has(f.assessment));
    }
    return all;
  }, [bucket, asset, world, assessment]);

  // Filters
  const [filterSev, setFilterSev]       = useState('all');
  const [filterSla, setFilterSla]       = useState('all');
  const [filterKev, setFilterKev]       = useState('all');
  const [filterPoc, setFilterPoc]       = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy]             = useState('priority');
  const [selected, setSelected]         = useState(() => new Set());

  // Reset selection if scope changes (different campaign / asset / assessment)
  useEffect(() => {
    setSelected(new Set());
  }, [bucket && bucket.id, asset && asset.id, assessment]);

  const filtered = useMemo(() => {
    let out = findings;
    if (filterSev !== 'all')    out = out.filter(f => SEV[f.severity] === filterSev);
    if (filterSla !== 'all')    out = out.filter(f => f.slaState === filterSla);
    if (filterKev !== 'all')    out = out.filter(f => (filterKev === 'yes') ? f.kev : !f.kev);
    if (filterPoc !== 'all')    out = out.filter(f => (filterPoc === 'yes') ? f.poc : !f.poc);
    if (filterStatus !== 'all') out = out.filter(f => f.workflowStatus === filterStatus);

    if (sortBy === 'priority')   out = [...out].sort((a, b) => b.priorityScore - a.priorityScore);
    else if (sortBy === 'severity') out = [...out].sort((a, b) => a.severity - b.severity || b.priorityScore - a.priorityScore);
    else if (sortBy === 'age')   out = [...out].sort((a, b) => b.age - a.age);
    else if (sortBy === 'first') out = [...out].sort((a, b) => a.firstFound.localeCompare(b.firstFound));
    else if (sortBy === 'kev')   out = [...out].sort((a, b) => (b.kev - a.kev) || (b.priorityScore - a.priorityScore));
    return out;
  }, [findings, filterSev, filterSla, filterKev, filterPoc, filterStatus, sortBy]);

  // Stats over the (assessment-filtered) finding set
  const stats = useMemo(() => {
    let critHigh = 0, overdue = 0, kev = 0;
    findings.forEach(f => {
      if (f.severity <= 1) critHigh++;
      if (f.slaState === 'overdue') overdue++;
      if (f.kev) kev++;
    });
    return { total: findings.length, critHigh, overdue, kev };
  }, [findings]);

  const visible = filtered.slice(0, FINDINGS_RENDER_CAP);
  const allVisibleSelected = visible.length > 0 && visible.every(f => selected.has(f.id));
  const someVisibleSelected = !allVisibleSelected && visible.some(f => selected.has(f.id));

  const toggleOne = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAllVisible = () => {
    setSelected(prev => {
      const n = new Set(prev);
      if (allVisibleSelected) {
        visible.forEach(f => n.delete(f.id));
      } else {
        visible.forEach(f => n.add(f.id));
      }
      return n;
    });
  };
  const clearSelection = () => setSelected(new Set());

  // Three grid templates — Asset col toggles when scoped to one asset, and
  // Assessment col is hidden when global assessment filter is locked to one
  // type (since every visible row would have the same value).
  // Hide the Source column when there's exactly one source selected (every
  // visible row would show the same value). Show otherwise — including with
  // 2+ sources selected, where rows can vary.
  const showAssessmentCol = !assessment || assessment.size !== 1;
  const cols = (() => {
    // checkbox · sevDot · finding · cve · [asset] · kev · poc · priority · firstFound · age · sla · [assessment] · status
    const parts = ['24px', '16px', '1.4fr', '1.1fr'];
    if (!asset) parts.push('1.4fr');                    // asset
    parts.push('50px', '50px', '90px', '100px', '50px', '110px');
    if (showAssessmentCol) parts.push('110px');         // assessment
    parts.push('110px');                                 // status
    return parts.join(' ');
  })();

  // Severity options derived from data so empty severities don't show.
  const sevPresent = useMemo(() => {
    const s = new Set();
    findings.forEach(f => s.add(SEV[f.severity]));
    return SEV.filter(x => s.has(x));
  }, [findings]);

  const resetFilters = () => {
    setFilterSev('all'); setFilterSla('all'); setFilterKev('all'); setFilterPoc('all'); setFilterStatus('all');
  };

  return (
    <div className="fade-in">
      {/* breadcrumb */}
      <div style={{ padding: '20px 28px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <ArrowLeft size={14} /> Operations Brief
        </button>
        <ChevronRight size={12} color="var(--text-faint)" />
        <button onClick={() => onCampaign(bucket.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 12 }}>
          {bucket.verb} {bucket.noun}
        </button>
        {asset && (
          <>
            <ChevronRight size={12} color="var(--text-faint)" />
            <button onClick={() => onAsset(asset.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 12 }} className="mono">
              {asset.id}
            </button>
          </>
        )}
        <ChevronRight size={12} color="var(--text-faint)" />
        <span className="label" style={{ color: 'var(--text)' }}>Findings</span>
        <div style={{ marginLeft: 'auto' }}>
          <AssessmentChip assessment={assessment} onClear={onClearAssessment} />
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: '32px 28px 28px', borderBottom: `1px solid var(--border)`, position: 'relative' }} className="grain">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 32, alignItems: 'end' }}>
          <div>
            <div className="label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListChecks size={11} /> Findings · {bucket.verb} {bucket.noun}
              {asset && <><span style={{ color: 'var(--text-faint)' }}>·</span><span className="mono" style={{ textTransform: 'none', letterSpacing: 0 }}>{asset.id}</span></>}
            </div>
            <h1 className="display" style={{ fontSize: 44, fontWeight: 400, margin: 0, lineHeight: 1, color: 'var(--text)' }}>
              {asset ? 'Findings on this asset' : 'All findings'}
            </h1>
            <p style={{ color: 'var(--text-dim)', marginTop: 14, maxWidth: 560, fontSize: 13 }}>
              Individual finding-level view. Multi-select rows to bundle into a Corrective Action Plan.
              {asset
                ? <> Scoped to <span className="mono" style={{ color: 'var(--text)' }}>{asset.id}</span> within this campaign.</>
                : <> Spans every asset affected by this campaign.</>}
            </p>
          </div>
          <StatNum value={fmtNum(stats.total)} label="Findings" sub={asset ? 'on this asset' : `across ${bucket.affectedAssets ? '~' + fmtNum(bucket.affectedAssets) : ''} assets`} />
          <StatNum value={fmtNum(stats.critHigh)} label="Critical + High" accent="var(--sev-critical)" sub={`${((stats.critHigh / Math.max(1, stats.total)) * 100).toFixed(0)}% of findings`} />
          <StatNum value={fmtNum(stats.overdue)} label="SLA Overdue" accent={stats.overdue > 0 ? 'var(--sev-critical)' : 'var(--good)'} sub={stats.overdue > 0 ? 'past policy threshold' : 'all within policy'} />
          <StatNum value={fmtNum(stats.kev)} label="KEV" accent={stats.kev > 0 ? 'var(--sev-critical)' : 'var(--text-dim)'} sub="known exploited" />
        </div>
      </div>

      {/* action bar — selection + CAP buttons */}
      <div style={{
        padding: '16px 28px', borderBottom: `1px solid var(--border)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: selected.size > 0 ? 'var(--surface-2)' : 'var(--surface)', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 500, color: selected.size > 0 ? 'var(--accent)' : 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtNum(selected.size)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            selected
            {selected.size > 0 && (
              <button onClick={clearSelection} style={{ marginLeft: 12, background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: 11, textDecoration: 'underline' }}>
                clear
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            disabled={selected.size === 0}
            onClick={() => {/* placeholder */}}
            className={selected.size > 0 ? 'card-hover' : ''}
            style={{
              background: selected.size > 0 ? 'var(--accent)' : 'transparent',
              color:      selected.size > 0 ? 'var(--bg)'     : 'var(--text-faint)',
              border: `1px solid ${selected.size > 0 ? 'var(--accent)' : 'var(--border)'}`,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <Plus size={13} /> Add to CAP
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => {/* placeholder */}}
            className={selected.size > 0 ? 'card-hover' : ''}
            style={{
              background: 'transparent',
              color: selected.size > 0 ? 'var(--text)' : 'var(--text-faint)',
              border: `1px solid ${selected.size > 0 ? 'var(--border-bright)' : 'var(--border)'}`,
              padding: '8px 14px', fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <FilePlus size={13} /> Add to Existing CAP
          </button>
        </div>
      </div>

      {/* filter row */}
      <div style={{
        padding: '14px 28px', borderBottom: `1px solid var(--border)`,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: 'var(--surface)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginRight: 8 }}>
          Showing <span style={{ color: 'var(--text)' }}>{fmtNum(filtered.length)}</span> of {fmtNum(stats.total)}
        </div>
        <FilterSelect value={filterSev}    onChange={setFilterSev}    options={[['all', 'All Severities'],   ...sevPresent.map(s => [s, s])]} />
        <FilterSelect value={filterSla}    onChange={setFilterSla}    options={[['all', 'All SLA'],          ['overdue', 'Overdue'], ['approaching', 'Approaching'], ['ok', 'On track']]} />
        <FilterSelect value={filterKev}    onChange={setFilterKev}    options={[['all', 'KEV: any'],         ['yes', 'KEV: yes'],   ['no', 'KEV: no']]} w={120} />
        <FilterSelect value={filterPoc}    onChange={setFilterPoc}    options={[['all', 'POC: any'],         ['yes', 'POC: yes'],   ['no', 'POC: no']]} w={120} />
        <FilterSelect value={filterStatus} onChange={setFilterStatus} options={[['all', 'All Statuses'], ...STATUS_OPTS.map(([s]) => [s, s])]} />
        <FilterSelect value={sortBy}       onChange={setSortBy}       options={[
          ['priority', 'Sort: Priority Score'],
          ['severity', 'Sort: Severity'],
          ['kev',      'Sort: KEV first'],
          ['age',      'Sort: Oldest first'],
          ['first',    'Sort: First found'],
        ]} w={170} />
      </div>

      {/* table */}
      <div style={{ padding: '20px 28px' }}>
        <div style={{ border: `1px solid var(--border)` }}>
          <div className="label" style={{
            display: 'grid', gridTemplateColumns: cols,
            gap: 12, padding: '10px 16px', borderBottom: `1px solid var(--border)`,
            background: 'var(--surface)', alignItems: 'center',
          }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={el => { if (el) el.indeterminate = someVisibleSelected; }}
                onChange={toggleAllVisible}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </span>
            <span></span>
            <span>Finding</span>
            <span>CVE</span>
            {!asset && <span>Asset</span>}
            <span>KEV</span>
            <span>POC</span>
            <span style={{ textAlign: 'right' }}>Priority</span>
            <span>First Found</span>
            <span>Age</span>
            <span>SLA</span>
            {showAssessmentCol && <span>Source</span>}
            <span>Status</span>
          </div>

          {visible.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              <div style={{ marginBottom: 8 }}>No findings match the current filters.</div>
              <button onClick={resetFilters} style={{
                background: 'transparent', border: `1px solid var(--border)`,
                color: 'var(--text)', padding: '6px 12px', fontSize: 12,
              }}>Reset filters</button>
            </div>
          )}

          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {visible.map((f, i) => {
              const isSel = selected.has(f.id);
              return (
                <div key={f.id} onClick={() => toggleOne(f.id)} style={{
                  display: 'grid', gridTemplateColumns: cols,
                  gap: 12, padding: '10px 16px',
                  borderBottom: i < visible.length - 1 ? `1px solid var(--border)` : 'none',
                  fontSize: 12, alignItems: 'center', cursor: 'pointer',
                  background: isSel ? 'rgba(180,120,40,0.06)' : 'transparent',
                }} className="clickable">
                  <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(f.id)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </span>
                  <SevDot sev={f.severity} size={6} />
                  <span className="mono" style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.id}</span>
                  <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.cve}</span>
                  {!asset && (
                    <div onClick={e => { e.stopPropagation(); onAsset(f.assetId); }}
                         style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, color: 'var(--text-dim)' }}
                         className="card-hover">
                      <span className="mono" style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {f.assetId}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAssetMeta && onAssetMeta(f.assetId); }}
                        title="Asset metadata"
                        style={{ background: 'transparent', border: 'none', padding: 2, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <Info size={12} />
                      </button>
                    </div>
                  )}
                  <YesNoBadge on={f.kev} tone="critical" />
                  <YesNoBadge on={f.poc} tone="high" />
                  <span className="mono" style={{
                    textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    color: priorityColor(f.priorityScore), fontWeight: 600,
                  }}>{f.priorityScore}</span>
                  <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>{f.firstFound}</span>
                  <span className="mono" style={{
                    color: f.slaState === 'overdue' ? 'var(--sev-critical)' : 'var(--text-dim)',
                    fontSize: 11, fontVariantNumeric: 'tabular-nums',
                  }}>{f.age}d</span>
                  <span>
                    {f.slaState === 'ok'
                      ? <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span>
                      : <SlaBadge status={f.slaState} sm />}
                  </span>
                  {showAssessmentCol && <AssessmentTag assessment={f.assessment} sm />}
                  <StatusTag status={f.workflowStatus} />
                </div>
              );
            })}
          </div>
        </div>
        {filtered.length > FINDINGS_RENDER_CAP && (
          <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', borderLeft: `1px solid var(--border)`, borderRight: `1px solid var(--border)`, borderBottom: `1px solid var(--border)` }}>
            + {fmtNum(filtered.length - FINDINGS_RENDER_CAP)} more · in production this list would virtualize
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT FILTER PANEL — slide-in flyout for multi-selecting which scanner
// sources should drive the data shown in the rest of the UI. Empty selection
// = no filter. Changes apply live as the user toggles checkboxes; Done just
// dismisses. Modeled on EstimatesPanel for visual consistency.
// ─────────────────────────────────────────────────────────────────────────────
function AssessmentFilterPanel({ open, onClose, assessment, onChange, buckets }) {
  // Live counts per type so the user can see how big each source is before
  // toggling. Computed against the unfiltered bucket list.
  const counts = useMemo(() => {
    const m = { all: 0 };
    ASSESSMENT_KEYS.forEach(k => { m[k] = 0; });
    buckets.forEach(b => {
      m.all += b.count;
      ASSESSMENT_KEYS.forEach(k => {
        m[k] += b.count * (b.assessmentMix[k] || 0);
      });
    });
    return m;
  }, [buckets]);

  const toggle = (k) => {
    const next = new Set(assessment);
    if (next.has(k)) next.delete(k); else next.add(k);
    onChange(next);
  };
  const selectAll = () => onChange(new Set(ASSESSMENT_KEYS));
  const clearAll  = () => onChange(new Set());

  const activeCount = assessment ? assessment.size : 0;
  const filteredTotal = useMemo(() => {
    if (!assessment || assessment.size === 0) return counts.all;
    let t = 0;
    assessment.forEach(k => { t += counts[k] || 0; });
    return t;
  }, [counts, assessment]);

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} className="fade-in" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50,
      }}/>
      <aside className="slide-in" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: 'var(--surface)', borderLeft: `1px solid var(--border-bright)`, zIndex: 51,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Filter</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 400 }}>Assessment Sources</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4, cursor: 'pointer' }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding: '18px 24px', borderBottom: `1px solid var(--border)`, background: 'var(--surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Selected</div>
              <div className="mono display" style={{ fontSize: 22, color: activeCount > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                {activeCount === 0 ? 'All' : `${activeCount} of ${ASSESSMENT_KEYS.length}`}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Findings shown</div>
              <div className="mono display" style={{ fontSize: 22, color: 'var(--text)' }}>
                {fmtNum(Math.round(filteredTotal))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
            Pick one or more scanner sources. Empty selection means no filter — every source contributes.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={selectAll} style={{
              background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
              padding: '4px 10px', fontSize: 11, cursor: 'pointer',
            }}>Select all</button>
            <button onClick={clearAll} disabled={activeCount === 0} style={{
              background: 'transparent', border: `1px solid var(--border)`,
              color: activeCount === 0 ? 'var(--text-faint)' : 'var(--text)',
              padding: '4px 10px', fontSize: 11,
              cursor: activeCount === 0 ? 'not-allowed' : 'pointer',
            }}>Clear all</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {ASSESSMENT_KEYS.map(k => {
            const t = ASSESSMENT_TYPES[k];
            const Icon = t.icon;
            const checked = assessment && assessment.has(k);
            const count = counts[k] || 0;
            return (
              <label key={k} className="card-hover" style={{
                display: 'grid', gridTemplateColumns: '20px 28px 1fr auto',
                alignItems: 'center', gap: 12, padding: '12px 24px',
                borderBottom: `1px solid var(--border)`, cursor: 'pointer',
                background: checked ? 'var(--surface-2)' : 'transparent',
              }}>
                <input
                  type="checkbox"
                  checked={!!checked}
                  onChange={() => toggle(k)}
                  style={{ accentColor: t.color, cursor: 'pointer', width: 14, height: 14 }}
                />
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color }}>
                  <Icon size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{t.desc}</div>
                </div>
                <span className="mono" style={{
                  fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}>
                  {fmtNum(Math.round(count))}
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid var(--border)`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Done</button>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATES PANEL
// ─────────────────────────────────────────────────────────────────────────────
function EstimatesPanel({ open, onClose, buckets, estimates, setEstimates, baseTotalHours }) {
  const [draft, setDraft] = useState(estimates);
  useEffect(() => { setDraft(estimates); }, [estimates, open]);

  const liveHoursMap = useMemo(() => {
    const m = {};
    buckets.forEach(b => { m[b.id] = computeEffectiveHours(b, draft[b.id]); });
    return m;
  }, [buckets, draft]);
  const liveTotal = Object.values(liveHoursMap).reduce((a, b) => a + b, 0);
  const delta = liveTotal - baseTotalHours;

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} className="fade-in" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50,
      }}/>
      <aside className="slide-in" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 540,
        background: 'var(--surface)', borderLeft: `1px solid var(--border-bright)`, zIndex: 51,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Configuration</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 400 }}>Time Estimates</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4 }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding: '18px 24px', borderBottom: `1px solid var(--border)`, background: 'var(--surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Live Total</div>
              <div className="mono display" style={{ fontSize: 24, color: 'var(--accent)' }}>{fmtHours(liveTotal)}</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Δ from current</div>
              <div className="mono display" style={{ fontSize: 24, color: delta > 0 ? 'var(--sev-high)' : delta < 0 ? 'var(--good)' : 'var(--text-dim)' }}>
                {delta > 0 ? '+' : ''}{fmtHours(Math.abs(delta))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
            Each baseline is multiplied by asset class (server 1.0 · db 1.45 · app 1.10 · container 0.65),
            environment (prod 1.5 · staging 1.0 · dev 0.7), and average criticality per environment.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {buckets.map((b, i) => {
            const v = draft[b.id] ?? b.baseHours;
            const overridden = draft[b.id] !== undefined && draft[b.id] !== b.baseHours;
            return (
              <div key={b.id} style={{
                padding: '14px 24px',
                borderBottom: i < buckets.length - 1 ? `1px solid var(--border)` : 'none',
                display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: 'var(--text-dim)' }}>{b.verb}</span>{' '}{b.noun}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {fmtNum(b.affectedAssets)} assets → {fmtHours(liveHoursMap[b.id])}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" step="0.25" min="0" value={v}
                    onChange={e => setDraft({ ...draft, [b.id]: parseFloat(e.target.value) || 0 })}
                    className="mono"
                    style={{
                      background: 'var(--bg)',
                      border: `1px solid ${overridden ? 'var(--accent)' : 'var(--border)'}`,
                      color: overridden ? 'var(--accent)' : 'var(--text)',
                      padding: '6px 8px', fontSize: 13, width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>h</span>
                </div>
                <button
                  onClick={() => { const n = { ...draft }; delete n[b.id]; setDraft(n); }}
                  disabled={!overridden}
                  style={{
                    background: 'transparent', border: 'none',
                    color: overridden ? 'var(--text-dim)' : 'var(--text-faint)',
                    cursor: overridden ? 'pointer' : 'default', padding: 4,
                  }}
                  title={overridden ? `Reset to ${b.baseHours}h` : 'unchanged'}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: 20, borderTop: `1px solid var(--border)`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setDraft({})} style={{
            background: 'transparent', border: `1px solid var(--border)`, color: 'var(--text)',
            padding: '8px 14px', fontSize: 12,
          }}>Reset all</button>
          <button onClick={onClose} style={{
            background: 'var(--surface-3)', border: `1px solid var(--border-bright)`, color: 'var(--text)',
            padding: '8px 14px', fontSize: 12,
          }}>Cancel</button>
          <button onClick={() => { setEstimates(draft); onClose(); }} style={{
            background: 'var(--accent)', border: `1px solid var(--accent)`, color: 'var(--bg)',
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
          }}>Apply changes</button>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function Footer({ totalFindings }) {
  return (
    <footer style={{ padding: '40px 28px', borderTop: `1px solid var(--border)`, color: 'var(--text-faint)', fontSize: 11, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div className="mono">{BRAND.name} · {BRAND.footerNote} · {fmtNum(totalFindings)} synthetic findings · 5,000-asset registry</div>
      <div className="mono">v0.3 · all data fictional</div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const buckets = useMemo(() => buildBuckets(), []);
  const world = useMemo(() => buildAssetWorld(buckets), [buckets]);
  const [estimates, setEstimates] = useState({});
  const [route, navigate] = useRoute();
  const [showEstimates, setShowEstimates] = useState(false);
  const [metaAssetId, setMetaAssetId] = useState(null);

  // Per-campaign assignments — Map<bucketId, string[] personIds>.
  // Seed a handful so the demo shows the avatar overlay out of the box.
  // CURRENT_USER_ID (jane.doe) appears on a few so the "Only my campaigns"
  // filter on the overview has meaningful coverage.
  const [assignments, setAssignments] = useState(() => ({
    'patch-log4j':       ['priya.patel', 'marcus.chen', 'sam.okafor', 'iris.tanaka', 'jane.doe'],
    'upgrade-openssl':   ['priya.patel', 'akira.yamada'],
    'patch-apache':      ['lukas.mueller', 'sam.okafor'],
    'upgrade-postgres':  ['noor.khan', 'chen.liu', 'jane.doe'],
    'rotate-ssh':        ['derek.ross', 'maria.garcia', 'akira.yamada', 'jane.doe'],
    'upgrade-k8s':       ['iris.tanaka', 'sam.okafor', 'lukas.mueller', 'derek.ross', 'akira.yamada'],
    'enable-mfa':        ['jane.doe', 'priya.patel'],
    'upgrade-rhel':      ['akira.yamada', 'maria.garcia'],
    'configure-tls':     ['marcus.chen', 'jane.doe'],
  }));
  const [pickerBucketId, setPickerBucketId] = useState(null);

  // Asset claims — Set<`${bucketId}:${assetId}`> of (campaign × asset) pairs
  // the current user has personally claimed responsibility for. Lives in
  // memory only; no persistence. Used purely as a visual "in work" marker
  // on the asset rows in BucketDetail and AssetDetail.
  const [claims, setClaims] = useState(() => new Set());
  const toggleClaim = useCallback((bucketId, assetId) => {
    setClaims(prev => {
      const next = new Set(prev);
      const key = `${bucketId}:${assetId}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const isClaimed = useCallback((bucketId, assetId) => claims.has(`${bucketId}:${assetId}`), [claims]);

  // Create-campaign modal state — visual only; no actual creation behavior.
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

  // Assessment-source filter flyout open/close
  const [showAssessmentFilter, setShowAssessmentFilter] = useState(false);

  // Apply theme to root via setProperty — supports any theme key in THEMES.
  useEffect(() => {
    applyThemeVars(route.theme);
  }, [route.theme]);

  const hoursMap = useMemo(() => {
    const m = {};
    buckets.forEach(b => { m[b.id] = computeEffectiveHours(b, estimates[b.id]); });
    return m;
  }, [buckets, estimates]);

  const assessment = route.assessment || new Set();

  // Display data — buckets, hours map, and per-asset entries scaled by each
  // bucket's share of the active assessment filter. Buckets with zero share of
  // the selected type are dropped entirely so the treemap, lens cards, and
  // overview totals match the active filter. The original `buckets`/`world`
  // are still available for any view that needs the unfiltered data.
  const displayBuckets = useMemo(() => {
    if (assessment.size === 0) return buckets;
    return buckets
      .map(b => {
        const s = bucketShare(b, assessment);
        if (s <= 0) return null;
        const scale = (n) => Math.round(n * s);
        const scaleArr = (arr) => arr.map(scale);
        return {
          ...b,
          count: scale(b.count),
          sevCounts: scaleArr(b.sevCounts),
          assetCounts: scaleArr(b.assetCounts),
          affectedAssetsByType: scaleArr(b.affectedAssetsByType),
          affectedAssets: scale(b.affectedAssets),
          riskScore: b.riskScore * s,
          overdueBySev: scaleArr(b.overdueBySev),
          approachingBySev: scaleArr(b.approachingBySev),
          overdueTotal: scale(b.overdueTotal),
          approachingTotal: scale(b.approachingTotal),
          policyPressure: b.policyPressure * s,
          assetMix: Object.fromEntries(Object.entries(b.assetMix).map(([k, v]) => [k, scale(v)])),
          _share: s,
        };
      })
      .filter(Boolean);
  }, [buckets, assessment]);

  const displayHoursMap = useMemo(() => {
    if (assessment.size === 0) return hoursMap;
    const m = {};
    displayBuckets.forEach(b => { m[b.id] = (hoursMap[b.id] || 0) * b._share; });
    return m;
  }, [hoursMap, displayBuckets, assessment]);

  // Scale per-asset entries inside world.bucketAssets so per-bucket asset
  // tables and per-asset campaign tables reflect the filter too.
  const displayWorld = useMemo(() => {
    if (assessment.size === 0) return world;
    const newBucketAssets = new Map();
    const newAssetFindings = new Map();
    buckets.forEach(b => {
      const s = bucketShare(b, assessment);
      if (s <= 0) return;
      const list = (world.bucketAssets.get(b.id) || []).map(e => {
        const fc = Math.max(1, Math.round(e.findingsCount * s));
        const scaleArr = (arr) => arr.map(n => Math.round(n * s));
        return {
          ...e,
          findingsCount: fc,
          sevCounts: scaleArr(e.sevCounts),
          overdueBySev: scaleArr(e.overdueBySev),
          approachingBySev: scaleArr(e.approachingBySev),
          overdueTotal: Math.round(e.overdueTotal * s),
          approachingTotal: Math.round(e.approachingTotal * s),
        };
      });
      newBucketAssets.set(b.id, list);
      list.forEach(e => {
        if (!newAssetFindings.has(e.assetId)) newAssetFindings.set(e.assetId, []);
        newAssetFindings.get(e.assetId).push(e);
      });
    });
    // Burndown — scale uniformly by the global share across all buckets so the
    // trend chart visually reflects the filter while staying smooth. Each
    // series is a flat array of numbers (one per day), not objects.
    const totalCount = buckets.reduce((acc, b) => acc + b.count, 0);
    const filteredCount = buckets.reduce((acc, b) => acc + b.count * bucketShare(b, assessment), 0);
    const globalScale = totalCount > 0 ? filteredCount / totalCount : 0;
    const scaleSeries = (s) => s ? s.map(v => Math.round(v * globalScale)) : s;
    const newBurndowns = {
      global: scaleSeries(world.burndowns.global),
      byBucket: new Map([...world.burndowns.byBucket.entries()].map(([bid, series]) => {
        const b = buckets.find(b => b.id === bid);
        const sc = b ? bucketShare(b, assessment) : 0;
        return [bid, series.map(v => Math.round(v * sc))];
      })),
      byAsset: new Map([...world.burndowns.byAsset.entries()].map(([aid, series]) => {
        return [aid, series.map(v => Math.round(v * globalScale))];
      })),
    };
    return {
      ...world,
      bucketAssets: newBucketAssets,
      assetFindings: newAssetFindings,
      burndowns: newBurndowns,
    };
  }, [world, buckets, assessment]);

  const totalHours = Object.values(displayHoursMap).reduce((a, b) => a + b, 0);
  const totalFindings = displayBuckets.reduce((s, b) => s + b.count, 0);

  const goOverview = () => navigate({ kind: 'overview' });
  const goBucket = (id) => navigate({ kind: 'bucket', bucketId: id });
  const goAsset = (assetId, bucketId) => navigate({ kind: 'asset', bucketId: bucketId || route.bucketId, assetId });
  const goFindings = (bucketId, assetId = null) => navigate({ kind: 'findings', bucketId, assetId });
  const selectTheme = (next) => navigate(undefined, next);
  const openMeta = (assetId) => setMetaAssetId(assetId);
  const closeMeta = () => setMetaAssetId(null);
  const openPicker = (bucketId) => setPickerBucketId(bucketId);
  const closePicker = () => setPickerBucketId(null);
  const applyAssignment = (bucketId, personIds) => {
    setAssignments(prev => ({ ...prev, [bucketId]: personIds }));
  };
  // Helper: turn personId list into Person objects, filtering unknowns
  const peopleFor = (bucketId) => (assignments[bucketId] || [])
    .map(id => PEOPLE_BY_ID.get(id)).filter(Boolean);

  const setAssessment = useCallback((next) => navigate(undefined, undefined, next), [navigate]);
  const setOnlyMine = useCallback((next) => navigate(undefined, undefined, undefined, !!next), [navigate]);

  const onlyMine = !!route.onlyMine;
  const currentUser = PEOPLE_BY_ID.get(CURRENT_USER_ID) || null;

  // Treemap-only filter: when "Only my campaigns" is on, hide buckets the
  // current user isn't assigned to. Applied AFTER displayBuckets (assessment
  // filter) so the two filters compose. Summary band and lens cards keep the
  // org-wide view because they're navigational context, not "my work".
  const treemapBuckets = useMemo(() => {
    if (!onlyMine || !currentUser) return displayBuckets;
    return displayBuckets.filter(b => (assignments[b.id] || []).includes(currentUser.id));
  }, [displayBuckets, onlyMine, currentUser, assignments]);
  const myCampaignsCount = useMemo(() => {
    if (!currentUser) return 0;
    return displayBuckets.filter(b => (assignments[b.id] || []).includes(currentUser.id)).length;
  }, [displayBuckets, currentUser, assignments]);

  const selectedBucket = (route.kind === 'bucket' || route.kind === 'asset' || route.kind === 'findings')
    ? displayBuckets.find(b => b.id === route.bucketId) : null;
  // The unfiltered bucket (used when the assessment filter has hidden the
  // current bucket — we still want to render a placeholder rather than
  // bouncing to overview).
  const selectedBucketRaw = (route.kind === 'bucket' || route.kind === 'asset' || route.kind === 'findings')
    ? buckets.find(b => b.id === route.bucketId) : null;
  const findingsAsset = (route.kind === 'findings' && route.assetId) ? world.assetMap.get(route.assetId) : null;
  const metaAsset = metaAssetId ? world.assetMap.get(metaAssetId) : null;
  const pickerBucket = pickerBucketId ? buckets.find(b => b.id === pickerBucketId) : null;

  // If a deep-link points at a totally unknown bucket id, recover to overview.
  // (We do NOT recover when the bucket exists but has been hidden by the
  // assessment filter — those pages render a "no findings of this type" state.)
  useEffect(() => {
    if ((route.kind === 'bucket' || route.kind === 'findings' || route.kind === 'asset') && route.bucketId && !selectedBucketRaw) {
      navigate({ kind: 'overview' });
    }
  }, [route.kind, route.bucketId, selectedBucketRaw, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <GlobalStyles />
      <Header
        totalFindings={totalFindings}
        totalHours={totalHours}
        theme={route.theme}
        onSelectTheme={selectTheme}
        onSettings={() => setShowEstimates(true)}
        onHome={goOverview}
        world={world}
        buckets={buckets}
        onJumpAsset={(aid) => {
          // Jump to asset detail. Use the user's first campaign that affects
          // this asset as the breadcrumb anchor; fall back to the first known
          // campaign if none on the user's plate touch the asset.
          const entries = world.assetFindings.get(aid) || [];
          const bid = entries.length ? entries[0].bucketId : (buckets[0] && buckets[0].id);
          if (bid) goAsset(aid, bid);
        }}
        onJumpCampaign={(bid) => goBucket(bid)}
        onOpenSources={() => setShowAssessmentFilter(true)}
        activeSourcesCount={assessment.size}
      />

      {route.kind === 'overview' && (
        <div className="fade-in">
          <SummaryBand buckets={displayBuckets} totalHours={totalHours} burndown={displayWorld.burndowns.global} assessment={assessment} />
          <LensesRow buckets={displayBuckets} hoursMap={displayHoursMap} onPick={goBucket} />
          <MyCampaignsToggle
            onlyMine={onlyMine}
            onChange={setOnlyMine}
            currentUser={currentUser}
            mineCount={myCampaignsCount}
            totalCount={displayBuckets.length}
            rightSlot={
              <button
                onClick={() => setShowCreateCampaign(true)}
                className="card-hover"
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={13} /> Create Campaign
              </button>
            }
          />
          <CampaignTreemap
            buckets={treemapBuckets} hoursMap={displayHoursMap} onPick={goBucket} theme={route.theme}
            assignmentsByBucket={peopleFor}
          />
          <Footer totalFindings={totalFindings} />
        </div>
      )}

      {route.kind === 'bucket' && selectedBucketRaw && (
        selectedBucket ? (
          <BucketDetail
            bucket={selectedBucket}
            hours={displayHoursMap[selectedBucket.id]}
            onBack={goOverview}
            onAsset={(aid) => goAsset(aid, selectedBucket.id)}
            onAssetMeta={openMeta}
            onFindings={() => goFindings(selectedBucket.id)}
            estimates={estimates}
            setEstimates={setEstimates}
            world={displayWorld}
            burndown={displayWorld.burndowns.byBucket.get(selectedBucket.id)}
            assignedPeople={peopleFor(selectedBucket.id)}
            onOpenPicker={openPicker}
            assessment={assessment}
            onClearAssessment={() => setAssessment(new Set())}
            currentUser={currentUser}
            isClaimed={isClaimed}
            onToggleClaim={toggleClaim}
          />
        ) : (
          <FilteredEmptyState
            kind="campaign"
            label={selectedBucketRaw ? `${selectedBucketRaw.verb} ${selectedBucketRaw.noun}` : ''}
            assessment={assessment}
            onClearAssessment={() => setAssessment(new Set())}
            onBack={goOverview}
          />
        )
      )}

      {route.kind === 'asset' && (
        <AssetDetail
          assetId={route.assetId}
          fromBucketId={route.bucketId}
          world={displayWorld}
          buckets={displayBuckets}
          estimates={estimates}
          onBack={goOverview}
          onCampaign={goBucket}
          onAsset={(aid) => goAsset(aid, route.bucketId)}
          onAssetMeta={openMeta}
          onFindings={(bucketId) => goFindings(bucketId, route.assetId)}
          burndown={displayWorld.burndowns.byAsset.get(route.assetId)}
          assessment={assessment}
          onClearAssessment={() => setAssessment(new Set())}
          currentUser={currentUser}
          isClaimed={isClaimed}
          onToggleClaim={toggleClaim}
        />
      )}

      {route.kind === 'findings' && selectedBucketRaw && (
        <FindingsView
          bucket={selectedBucketRaw}
          asset={findingsAsset}
          world={world}
          onBack={goOverview}
          onCampaign={goBucket}
          onAsset={(aid) => goAsset(aid, selectedBucketRaw.id)}
          onAssetMeta={openMeta}
          assessment={assessment}
          onClearAssessment={() => setAssessment(new Set())}
        />
      )}

      <EstimatesPanel
        open={showEstimates}
        onClose={() => setShowEstimates(false)}
        buckets={buckets}
        estimates={estimates}
        setEstimates={setEstimates}
        baseTotalHours={Object.values(hoursMap).reduce((a, b) => a + b, 0)}
      />

      {metaAsset && (
        <AssetMetaModal
          asset={metaAsset}
          onClose={closeMeta}
          burndown={world.burndowns.byAsset.get(metaAsset.id)}
        />
      )}

      <PeoplePickerModal
        open={!!pickerBucket}
        bucket={pickerBucket}
        initialSelected={pickerBucketId ? assignments[pickerBucketId] : []}
        onClose={closePicker}
        onApply={(ids) => applyAssignment(pickerBucketId, ids)}
      />

      <CreateCampaignModal
        open={showCreateCampaign}
        onClose={() => setShowCreateCampaign(false)}
      />

      <AssessmentFilterPanel
        open={showAssessmentFilter}
        onClose={() => setShowAssessmentFilter(false)}
        assessment={assessment}
        onChange={setAssessment}
        buckets={buckets}
      />
    </div>
  );
}
