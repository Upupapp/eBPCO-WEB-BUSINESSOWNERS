#!/usr/bin/env node
/**
 * Route-vs-inventory gate (FE task 17).
 *
 * The Screen Inventory and app.routes.ts drifted with nothing comparing them —
 * the same way the heading scale drifted before check:headings. Renewal and
 * Amendment sat in the inventory as three screens each while the router had
 * neither, and nothing said so.
 *
 * This gate does NOT claim a screen is well built. It cannot: a route existing
 * is not the screen working (see servana-trace-the-operation). What it does is
 * make it impossible for a citizen-facing screen to go UNRULED-ON. Every ID in
 * the inventory must appear in screen-inventory.map.json as a route, as a step
 * within one, or as a recorded absence with a reason.
 *
 * Three ways it fails:
 *   1. The inventory has a citizen screen the map never mentions.
 *   2. The map names a route the router does not have.
 *   3. The map mentions an ID the inventory no longer contains (stale).
 *
 * (3) matters as much as (1). A map that keeps entries for deleted screens
 * quietly loses its denominator, and a gate that counts the wrong denominator
 * reports a pass it did not earn.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const INVENTORY = resolve(here, '../../docs/08-Reusable-Stitch/04-Screen-Inventory.md');
const ROUTES = resolve(here, '../src/app/app.routes.ts');
const MAP = resolve(here, 'screen-inventory.map.json');

/** Prefixes this lane owns. The rest is the admin portal — a different repo and a different agent. */
const CITIZEN = ['PUB', 'SHR', 'BUS', 'PER', 'REN', 'AMD', 'DOC', 'PAY', 'TRA'];

const fail = (msg) => {
  console.error(`✘ ${msg}`);
  process.exitCode = 1;
};

// --- the inventory's citizen screens -----------------------------------------
const inventoryText = readFileSync(INVENTORY, 'utf8');
const inventory = new Map();
for (const line of inventoryText.split('\n')) {
  const m = line.match(/^\|\s*([A-Z]{2,5}-\d{3})\s*\|\s*([^|]+?)\s*\|/);
  if (m && CITIZEN.includes(m[1].split('-')[0])) inventory.set(m[1], m[2]);
}
if (inventory.size === 0) {
  fail('parsed ZERO screens from the Screen Inventory — the table format changed and this gate went blind.');
  process.exit(1);
}

// --- the router's real paths --------------------------------------------------
// Comments are stripped first: a gate that reads a commented-out route fails
// against its own explanation (gate-vs-its-own-explanation).
const routesText = readFileSync(ROUTES, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const routes = new Set([...routesText.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]));
if (routes.size === 0) {
  fail('parsed ZERO routes from app.routes.ts — this gate went blind.');
  process.exit(1);
}

// --- the ruling ---------------------------------------------------------------
const map = JSON.parse(readFileSync(MAP, 'utf8'));
const ruled = Object.keys(map).filter((k) => !k.startsWith('$'));

for (const [id, name] of inventory) {
  const entry = map[id];
  if (!entry) {
    fail(`${id} "${name}" is in the Screen Inventory and nothing in screen-inventory.map.json rules on it. Add a route, a "within", or an "absent" with the reason.`);
    continue;
  }
  const target = entry.route ?? entry.within;
  if (target && !routes.has(target)) {
    fail(`${id} "${name}" is mapped to '${target}', which app.routes.ts does not have.`);
  }
  if (!target && !entry.absent) {
    fail(`${id} "${name}" has an entry with no route, no "within" and no "absent" reason.`);
  }
}

for (const id of ruled) {
  if (!inventory.has(id)) {
    fail(`screen-inventory.map.json rules on ${id}, which is no longer a citizen screen in the Screen Inventory. Remove it, or the map's denominator is wrong.`);
  }
}

if (process.exitCode === 1) process.exit(1);

const gaps = ruled.filter((id) => map[id].absent);
const served = ruled.length - gaps.length;
console.log(
  `✔ all ${inventory.size} citizen screens in the Screen Inventory are ruled on ` +
    `(${served} served by a route, ${gaps.length} recorded as absent: ${gaps.join(', ')})`,
);
