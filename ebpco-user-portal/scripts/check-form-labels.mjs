#!/usr/bin/env node
/**
 * F-20 gate: every form control must be programmatically labelled.
 *
 * The portal had 50 controls, 49 visible <label> elements, and ZERO `for`
 * attributes. Every label was a sibling of its input, never associated with it.
 * Sighted users saw a labelled form; a screen reader announced "edit text,
 * blank" for all of it — including the whole registration form, where a citizen
 * enters their name, birth date, civil status and address, and the whole
 * profile form.
 *
 * A visual check cannot catch this: the screen looks correct. axe found it in
 * seconds, which is the argument for keeping this gate rather than re-reading
 * the markup.
 *
 * Run: npm run check:labels
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.html') ? [p] : [];
});

const failures = [];
for (const file of walk('src/app')) {
  if (file.endsWith('.spec.ts')) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/<label([^>]*)>([\s\S]*?)<\/label>/g)) {
    const [, attrs, text] = m;
    if (text.includes('<input')) continue;                 // wrapping label: already associated
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 200);
    const ctl = after.match(/<(input|select|textarea)\b([^>]*)>/);
    if (!ctl) continue;                                     // label with no adjacent control
    if (!/\bfor=/.test(attrs)) {
      failures.push(`${file}: <label> has no for= (label text: "${text.replace(/<[^>]+>/g, '').trim().slice(0, 40)}")`);
    } else if (!/\bid=/.test(ctl[2]) && !/aria-label/.test(ctl[2])) {
      failures.push(`${file}: <${ctl[1]}> after a for= label has no id=`);
    }
  }
}

if (failures.length) {
  console.error('✘ form-label check FAILED — controls a screen reader cannot name\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✔ every labelled form control is programmatically associated');
