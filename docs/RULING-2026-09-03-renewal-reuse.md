# Municipal ruling — renewal, amendment, and reuse

**Given by the owner on behalf of the Municipality, 3 September 2026.**
Answers citizen-web's question #0019. Delivered as bus #0042, confirmed #0045.

Recorded here because a ruling that lives only on the bus is one the next
session has to ask for again.

---

## 1. Renewal — nothing is ever omitted

The document list **does not shrink**. All twenty-two are still required.

What changes is who supplies them. A document already on file is **reused by
default** — carried over pre-selected, not re-uploaded. The citizen **may**
change it; replacing a reused document with a fresh one is always available and
never forced.

Every reused document is **flagged to the admin** as reused.

The burden falls without the requirement falling.

## 2. Amendment — the amendment scopes what is superseded

Also nothing omitted.

- **Amended items remove the old items.** What is being amended supersedes what
  was there; the previous document goes.
- **Everything else is reused in place**, and changes only if the citizen
  changes it.

So it does depend on what is being amended — but not by shortening a list.
Amending a contractor removes and replaces the contractor documents and leaves
the structural ones exactly as they were.

## 3. Re-certification — not required

A reused document past its validity **does not** need re-certification. It is
accepted and validated as it stands.

The admin sees a note on that document saying it is reused, **and the date it
was certified**. The judgement is the officer's with that in front of them. It
is not a hard block and the citizen is not sent away.

---

## What this binds in this repo

- **Reuse is the DEFAULT state** of a renewal or amendment form, not an opt-in.
- **The change affordance is obvious on every reused document**, always
  available, never disabled.
- **We carry and send the ORIGINAL CERTIFICATION DATE.** The admin note is built
  from it. This is stronger than the `expiresOn` we asked the backend for:
  an expiry cannot say when something was certified. Where both exist, the
  certification date is the one the note uses.
- **Nothing client-side may refuse a reused document for age.** No block, no
  greying out, and no warning phrased in a way that reads as a refusal. Refusing
  is not ours to do — the officer decides.

### The consequence that cuts against instinct

F-24 added an expiry warning on the documents view, and it is right there.
It is **scoped out of the reuse path**, because a warning we add for kindness
becomes a refusal the citizen believes. See `application-documents.component.ts`
and the reuse controls in `application-wizard.page.ts`.

### Copy that was correct and is now wrong

The wizard told a renewing citizen that *"the Municipality has not published a
shorter list"*. That was honest when written. It is now **wrong**: there is no
shorter list and there was never going to be one. Replaced with the fact that
their existing documents are already attached and can be swapped.

### Parity

Web and mobile are one product here and build this the same way. The field names
and affordance were proposed to citizen-mobile as bus #0364 before either lane
built, and to the backend as #0365.

---

## Unrelated decision recorded here for want of a better home

**Component stylesheet budget, settled 5 September 2026.**
`anyComponentStyle` is `maximumWarning: 10kB`, `maximumError: 12kB`.

Measured, not assumed: two compiled stylesheets are over the old 8 kB warning —
landing at 9.80 kB and dashboard at 9.00 kB. Onboarding is **not**, despite being
13.49 kB on disk; SCSS compiles down and the on-disk size is not the budget.

A warning that fires on every build forever is not a warning — it is noise that
teaches people to ignore build output, which is how the original F-1 error sat
unnoticed. The warning now sits just above the real figures so that it fires
when something actually grows.

**The next file to cross 10 kB gets SPLIT, not another raise.** The error stays
at 12 kB and is not to be moved. This is the "decide the ceiling once" the
website lane asked for.
