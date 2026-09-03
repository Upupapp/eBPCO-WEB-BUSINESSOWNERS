#!/usr/bin/env node
/**
 * F-20 gate: every form control must be programmatically labelled.
 *
 * The portal had 50 controls, 49 visible <label> elements, and ZERO `for`
 * attributes. Every label was a sibling of its input, never associated with it.
 * Sighted users saw a labelled form; a screen reader announced "edit text,
 * blank" for all of it — including the whole registration form.
 *
 * REWRITTEN 3 Sep 2026 after the admin lane, who hit the same defect class,
 * warned that a gate which does not understand Angular's binding forms reports
 * working code as broken — and the first thing anyone does with a false
 * positive is "fix" it. Their caution was right and understated. Measured, the
 * old gate had four defects:
 *
 *   1. A correctly WRAPPED <select> or <textarea> was reported as broken. The
 *      old skip was `text.includes('<input')` — inputs only — so a wrapped
 *      select fell through and was blamed for whatever control came next.
 *   2. `aria-label="••••••••"` PASSED. Presence was checked, never content.
 *      That is exactly the bad output the admin lane caught in review before
 *      committing; this gate would have blessed it.
 *   3. `[for]`, `[attr.for]` and `[id]` were unreadable to `\bfor=` / `\bid=`,
 *      so correct dynamic associations were reported as broken.
 *   4. The gate read only 200 characters after a label. A control whose opening
 *      tag was longer than that was INVISIBLE, and `continue` made that
 *      blindness look like a pass. This one masked (3) in our own shipped
 *      markup: a `[for]`/`[id]` pair passed not because the gate understood it
 *      but because it never saw the <select> at all.
 *
 * The fix for (4) is structural, not a bigger window: this version iterates
 * CONTROLS and asks whether each one has a name. A control cannot be skipped by
 * a scan that starts from the controls themselves.
 *
 * Run: npm run check:labels
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.html') ? [p] : [];
});

/** An opening tag, tolerating `>` inside quoted attribute values (Angular bindings contain them). */
const TAG = /<(input|select|textarea|label)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/**
 * Read an attribute in any of the forms Angular accepts.
 * `for=`, `[for]=`, `[attr.for]=`, `bind-for=` all name the same thing.
 * Returns the raw value, or undefined.
 */
function attr(attrs, name) {
  const m = attrs.match(
    new RegExp(`(?:\\[attr\\.${name}\\]|\\[${name}\\]|bind-${name}|${name})\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'),
  );
  return m ? (m[2] ?? m[3] ?? '') : undefined;
}

/** Whether an attribute is present at all, in any binding form. */
const has = (attrs, name) => attr(attrs, name) !== undefined;

/**
 * Is this string a usable accessible name?
 *
 * The admin lane generated names from bindings and reviewed the output before
 * committing: two password fields came out as `aria-label="••••••••"`, which a
 * screen reader reads as bullet characters. A presence check calls that
 * labelled. Anything with no letters or digits names nothing.
 */
function isMeaningfulName(v) {
  if (v === undefined) return false;
  const text = v.replace(/\{\{[\s\S]*?\}\}/g, ' ');       // interpolation is a real name at runtime
  if (/\{\{/.test(v)) return true;
  return /[\p{L}\p{N}]/u.test(text) && text.trim().length > 1;
}

/** Controls that do not need a label: hidden fields, and buttons that carry their own name. */
function exempt(tag, attrs) {
  const type = (attr(attrs, 'type') ?? '').toLowerCase();
  if (tag !== 'input') return false;
  return type === 'hidden' || type === 'submit' || type === 'button' || type === 'image';
}

/**
 * The whole check for one file's source, exported so the gate's own behaviour
 * can be tested.
 *
 * It was untested, and it had four defects at once — two reporting correct code
 * as broken, one blessing `aria-label="••••••••"`, and one silently blind to any
 * tag over 200 characters. A gate nobody checks is a gate nobody can trust, and
 * the blind one is the worst of the four because it looks exactly like a pass.
 */
export function checkSource(file, rawSrc) {
  const failures = [];
  // Comments are stripped first: a gate must not read its own explanation, nor
  // markup someone commented out. (gate-vs-its-own-explanation)
  const src = rawSrc.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

  // Pass 1 — every label: what it points at, and how far its wrapping reaches.
  const labels = [];
  for (const m of src.matchAll(new RegExp(TAG.source, 'g'))) {
    if (m[1] !== 'label') continue;
    const close = src.indexOf('</label>', m.index);
    labels.push({
      for: attr(m[2], 'for'),
      start: m.index,
      end: close === -1 ? m.index + m[0].length : close + '</label>'.length,
    });
  }
  const targets = new Set(labels.map((l) => l.for).filter((v) => v !== undefined));

  // Pass 2 — every control: can a screen reader name it?
  for (const m of src.matchAll(new RegExp(TAG.source, 'g'))) {
    const [whole, tag, attrs] = m;
    if (tag === 'label' || exempt(tag, attrs)) continue;

    const wrapped = labels.some((l) => m.index > l.start && m.index < l.end);
    if (wrapped) continue;                                    // <label>Name <select>…</select></label>

    const id = attr(attrs, 'id');
    if (id !== undefined && targets.has(id)) continue;         // for= / [for]= / [attr.for]= match

    if (isMeaningfulName(attr(attrs, 'aria-label'))) continue;
    if (has(attrs, 'aria-labelledby')) continue;

    const why = has(attrs, 'aria-label')
      ? `aria-label="${attr(attrs, 'aria-label')}" names nothing a screen reader can read`
      : id === undefined
        ? 'no id, and no aria-label — nothing can point at it'
        : `id "${id}" — no <label for> points at it`;
    failures.push(`${file}: <${tag}> ${why}\n      ${whole.replace(/\s+/g, ' ').slice(0, 100)}`);
  }
  return failures;
}

const failures = [];
for (const file of walk('src/app')) {
  if (file.endsWith('.spec.ts')) continue;
  failures.push(...checkSource(file, readFileSync(file, 'utf8')));
}

if (failures.length) {
  console.error('✘ form-label check FAILED — controls a screen reader cannot name\n');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\n  ${failures.length} control(s).`);
  process.exit(1);
}
console.log('✔ every form control has an accessible name (id/for, wrapping label, or aria-label with real text)');
