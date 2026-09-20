# Memorizer — a spaced repetition app

Product owner: Oleg Tsykhonia. The name in the interface is **Memorizer**, with
*by Oleg Tsykhonia* as a byline.

A personal flashcard trainer with images on the cards. One user.
Full specification: https://claude.ai/code/artifact/84853df6-1a8b-4f60-9652-0fe0eb510c6c

## Settled decisions

| What | Decision |
|---|---|
| Users | One account; registration closes once the first user exists |
| Framework | Next.js (App Router) + TypeScript, server actions instead of a separate API |
| Styling | Tailwind CSS, dark theme from the system setting plus a manual toggle |
| Database | Supabase Postgres, RLS on every table, `user_id` everywhere |
| Files | Supabase Storage, bucket `cards`, key `{user_id}/{card_id}/{uuid}.webp`, covers `{user_id}/topics/{topic_id}/{uuid}.webp` |
| Auth | Supabase Auth, email and password |
| Scheduling | FSRS via `ts-fsrs`, retention target 0.90, computed on the server only |
| CSV | PapaParse, delimiter auto-detection, BOM stripped |
| Import | A file or a paste from the clipboard; CSV and JSON, format detected on its own. JSON restores cards and categories — it never touches the schedule or the history |
| Hosting | Vercel Hobby (non-commercial, one cron per day) |
| Budget | $0 — a feature that needs a paid tier is not part of the MVP |

Do not reorder the stages: **core → media → CSV import → polish** (§14 of the spec).

Production: Vercel, deployed from `master`. Environment variables live in
Settings → Environment Variables, never in the repository.

## State: stages 1–2 closed, PWA in place

The skeleton is deployed and builds clean (`npx tsc --noEmit`, `npx eslint .`,
`npx next build`). Not yet exercised against a real database end to end: that
needs a Supabase project and a run of `supabase/migrations/0001_init.sql`.
Steps are in [README.md](README.md).

Code map:

| Where | What |
|---|---|
| `supabase/migrations/0001_init.sql` | Schema, indexes, triggers, RLS, the counts view |
| `proxy.ts` | Session refresh and guest redirect (the former middleware in Next 16) |
| `lib/supabase/` | Server and browser clients, `requireUser()` |
| `lib/data.ts` | Every server-side read: settings, the category tree, day counts, the queue |
| `lib/fsrs.ts` | Wrapper over ts-fsrs: DB row ↔ FSRS card mapping, interval previews |
| `lib/session.ts` | Review queue rules: returning a failed card, skipping, the progress denominator |
| `lib/swipe.ts` | Horizontal gesture parsing: threshold by width fraction and by velocity |
| `lib/import-format.ts` | CSV/JSON detection, folding JSON into the wizard's table, and where imported cards land |
| `lib/knowledge.ts` | The knowledge tree: reading `topics` with icon, archive and branch size |
| `lib/url.ts` | User link parsing: http(s) only, otherwise `null` |
| `lib/schema.ts` | Columns that may not exist: a query retried without them |
| `lib/knowledge-graph.ts` | Map data: nodes, edges, the count of attached cards |
| `lib/knowledge-tree.ts` | Relationship rules: a node's branch, drop validity, sibling order |
| `app/(app)/knowledge/map/` | The React Flow map: custom nodes, dagre layout, the node panel |
| `app/(app)/knowledge/` | The Knowledge section: category list, category screen, starters |
| `components/use-reorder.ts` | Moving cards by pointer and by keyboard |
| `lib/markdown.ts` | A tiny Markdown renderer that escapes HTML before parsing |
| `app/(app)/review/` | The session screen and the grade/undo actions |
| `app/(app)/decks/[id]/` | The only card editor: the deck workspace |
| `app/(app)/library/` | Search across all cards and bulk operations |
| `components/card-renderer.tsx` | The one place the card canvas is drawn, and `cardFrameStyle` — the one place its frame is measured |
| `tests/` | Vitest: pure logic — FSRS, Markdown, normalisation, day boundaries |
| `lib/image.ts` | Client-side compression: 1600 px, WebP q=0.82, 320 px thumbnail |
| `lib/upload.ts` | Uploading to Storage straight from the browser, marking orphans |
| `app/api/cron/sweep/` | Daily file cleanup and keeping the database awake |
| `scripts/make-icons.mjs` | PWA icons drawn in code via zlib, with no dependencies |

### Deliberate departures from the spec

- **TanStack Query is not wired in.** The queue is loaded once by a server
  component and lives in client state; grades go out optimistically. The library
  does not pay for itself on a single screen — revisit at stage 4 if background
  sync appears.
- **Images at stage 2 are served through a plain `<img>`, not `next/image`.**
  The files are already compressed on the client, and image optimisation on
  Vercel Hobby is capped.

## Design system

Tokens live in `app/globals.css`, primitives in `components/ui/`. Do not write
a new class string for a button or a field: if a variant is missing, add it to
the primitive rather than beside it.

| Role | What to use |
|---|---|
| Button | `Button` / `LinkButton`: tone `primary · soft · secondary · ghost · danger`, size `sm · md · lg · icon` |
| Input | `inputClass`, dropdown `selectClass`, in a table `cellInputClass` |
| Label and hint | `Field`, `Label` |
| Surface | `Panel`, `panelClass`, `raisedClass`, `insetClass` |
| Status pill | `Badge`: `neutral · accent · warn · danger` |
| Category picker | `useCategoryPicker` — pick by id, never type a path |
| Progress bar | `Progress`: `value`, `max`, amber segment `warn` |
| Micro label | `label-micro` — never assemble it from `font-mono text-2xs uppercase tracking-[…]` |
| Field border | `border-control` (token `--stroke`, 1.5 px) plus `border-field-line` |
| Button border | `border-button` (token `--stroke-button`, 2 px) plus `border-field-line` |
| Shadow | `shadow-card` rests on the background, `shadow-raised` lifts, `shadow-overlay` floats above everything |
| Radius | controls `rounded-lg`, panels `rounded-xl`, pills `rounded-full` |

Button and field heights come from the `--control-sm | --control-md |
--control-lg` tokens: `sm` 44 px, `md` 52 px, `lg` 60 px, `icon` — a 52 px
square for a single icon with no label. The minimum touch target on a phone is
44 px, so the scale never goes below it and `md` clears it with room to spare.
A button and an input on the same row match in height because both read the
same token — do not set a height beside them.

The type scale and the spacing step are tokens too: `--text-2xs … --text-3xl`
and `--spacing`. `--spacing` feeds every `gap-*`, `p-*` and `m-*` in the app,
so "give it more air" is one line there, never a sweep replacing `gap-2` with
`gap-3`. `--text-base` must stay at or above 16 px: inputs use it, and Safari
on iPhone zooms the page on focus below sixteen.

The border colour of a field and of an outlined button is the same,
`--field-line`, for the same reason: WCAG 1.4.11 requires 3:1 from the border
of a control, and `--line` gives 1.24.

Their thickness differs, deliberately: field 1.5 px, button 2 px. A field's
border outlines where to write — it marks the edge of an area. A button's
border forms the button itself: it is its shape, and it is what the finger aims
at. Both live in the `--stroke` and `--stroke-button` tokens — change them
there, not in class strings scattered through the code.

Input font size is 16 px. Not for looks: Safari on iPhone zooms the page when
focusing a field smaller than sixteen, and the user cannot zoom back out.

Amber means "not an error, but not normal either" — a suspended card, for
instance. Red (`rust`) is reserved for genuine failures.

## Rules specific to this project

- Images are compressed **on the client before upload**: fit within 1600 px, WebP q=0.82, plus a 320 px thumbnail. A category cover is 800 px with no thumbnail. Storage is capped at 1 GB — cleaning up afterwards is too late.
- Deleting a card does not delete its files synchronously — the path goes into `media_orphans` and the daily cron sweeps it.
- A node's name is unique only among its siblings (`unique(user_id, parent_id, name)`) — identical subtopics in different branches are normal, not a bug.
- A review grade is applied optimistically on the client (< 100 ms); the server recomputes the schedule from the client's timestamp.
- Mobile layout comes first: design from 360 px, grade buttons ≥ 56 px, respect `safe-area-inset`.
- CSV/JSON export is a required feature, not a "later": data must never be locked inside the app.
- **The knowledge map is React Flow (`@xyflow/react`) plus `@dagrejs/dagre`.** The library was chosen for one property: its node is an ordinary React component, so the map is drawn with the same tokens as the rest of the app. Canvas engines (Cytoscape, vis-network) cannot do that.
- **A card can live in several categories.** Its main home is `cards.topic_id`; the extra ones are `card_topics`. Never create copies: two copies mean two review histories for one piece of knowledge.
- **A category is `topics`, and there is no other table for it.** "Categories", "My flashcards" and review all look at one tree from different sides. Do not create a new entity for "category", "deck" or "topic".
- **The shape of the tree is enforced by a trigger: Category → Topic → Flashcards.** A category cannot sit inside a category, a topic cannot sit inside a topic, and a card lives only in a topic. A topic WITHOUT a category is still legal: a set is often made before anyone gets round to filing it, and demanding a category up front would force one to be invented out of nothing.
- **A card's `[Category] [Topic]` classification is derived from the path, not stored on the card.** A copy of the category name inside the card would diverge from the tree at the first rename. The component is `Classification`, the rule is `classify()` in `lib/knowledge-tree.ts`. It cannot be edited from the card: you change the place, not the label.
- **A node has a kind, and the kind is stated by intent, not inferred from data.** `topics.kind`: `area` — a category, holds structure and no cards of its own; `deck` — a group of cards, the thing you study; `source` — a source. A category and a group are created by DIFFERENT actions. A card can only live in a group, and a database trigger enforces that, not just the interface.
- **The word "area" means opposite things in the database and in the CSV, and that is deliberate.** `topics.kind = 'area'` is the CATEGORY — the top level. The CSV column `area` is the COLLECTION inside a category, the thing the code calls a deck. The column name is the product owner's vocabulary and is what the user types in a spreadsheet; the enum value is internal and cannot be renamed without a migration that rewrites every row. Read `kind` as "category", read the column as "collection", and never map one onto the other by name.
- **Where an imported card lands comes from two columns, `category` and `area`, not one path.** A single `topic` column made every row carry a separator that could also occur inside a name. The pair wins whenever `area` is filled; `topic` is still read so older files and exports keep working. The rule is `rowPath` in `lib/import-format.ts` and it is tested — a category with no area does NOT describe a place, because a card lives in a collection, and treating it as one created a deck named after the category at the root.
- **Kind counts only once the split is in effect** — that is, once at least one group exists (`kindInEffect()`). Migration 0015 sets `area` on EVERY node by default, and 0021 does the conversion to `deck`: in between, the database insists there are no decks at all. Code that read the kind literally hid the entire set list during that window. Until the split is in effect, the old inference from data applies.
- **There are no tags in the app.** They had no effect on learning — neither the schedule nor the queue ever read them — and they cost a screen, a palette, a column in import and export, and two tables. The "any number of labels per card" axis went unused and was removed along with the data (migration 0023). There is one structure: Category → Topic → Flashcards.
- **One menu entry per entity.** Screens that answer neighbouring questions about the same thing get merged, and the old address redirects: `/topics` → `/knowledge`, `/stats` → `/tags`.
- **Tree relationship rules live in `lib/knowledge-tree.ts` and are covered by tests.** A copy of those rules inside a component had already diverged from the database — it allowed a parent to be placed next to its own descendant.
- **Optional data must not be mandatory for a query.** A new column in a `SELECT` is a condition for the whole query: until the migration is applied, PostgREST rejects it entirely. Paid for by taking down the review queue over one line showing a source link. Helpers are in `lib/schema.ts`.
- **A card's source is two columns, not one.** `cards.link_url` is the address, checked against `^https?://` in the database and in `safeUrl()` because it goes into an `href`; `cards.source_label` (migration 0024) is the readable name — a book, a chapter, a lecture — which an address cannot express. Before it, the interface showed the link's host where a title belonged.
- **The importer speaks the product's language, not the file's.** A CSV column called `Area` maps to the field the app calls **Set**; `Front side` maps to **Question**. The mapping screen shows the application's names, because a label reading "Area" sends the person looking for an "Area" in an interface that has none. Translation is the importer's job.
- **A card's Source is the `cards.link_url` column.** It survived the removal of the Link property (migration 0009 was cancelled) and came back meaning "where this knowledge came from". The link goes into an `href`, so the scheme is checked both in the database and in `safeUrl()` — http(s) only.
- **The frame of a card is measured by `cardFrameStyle`, and nowhere else.** `aspect-ratio` together with `max-height` does NOT preserve the ratio: at a given width the height ceiling simply crops it, and a 2:3 card comes out landscape. The width has to be computed from the allowed height. The rule existed but lived in the review screen, so the second caller — deck browsing — never got it and passed `maxHeight` straight into the broken path.
- **Scrolling wraps centring, not the other way round.** `items-center` on a scrollable box centres while the content fits, but once it overflows the top escapes past the edge and cannot be scrolled to: overflow at the start of the axis gets no scrollbar. The scroll container stays plain, and a `min-h-full` row inside it does the centring.
- **A category for an import is created by `createImportCategory`, not `resolveTopicPath`.** That helper gives the last path segment the kind `deck`, because for a path the last segment is the group of cards. For a one-word category name that is exactly backwards.
- **Deleting a SET is permanent; deleting a CARD is not.** A card deleted on its own goes to the trash and comes back within 30 days. A set deleted from its card takes every card inside it and their review history with it, for good. The asymmetry is deliberate and was decided twice by the product owner over a stated objection — it is not an oversight to be "fixed". The confirmation says so in words, with the card count. Files need no hand-holding: deleting a `media` row raises `media_orphan_sweep` and the paths queue for the daily cleanup.
- **A category never holds cards, and no screen may imply otherwise.** The category screen once offered "Edit cards", which opened the deck workspace with a CATEGORY id — promising cards a category cannot have. Category actions act on the category; card actions live inside a set.
- **"Back" is contextual and carried in the URL as `?from=`, never hardcoded.** A set opened from its category used to return to "All decks", dropping the person out of the branch they were working in. The origin travels as a search param because component state does not survive a reload or a new tab, and `history.back()` cannot be labelled — a back link that cannot say where it leads makes you press it to find out. The path is validated against a whitelist in `lib/back.ts` (it comes from the address bar and goes into an `href`), and the label is looked up from the live tree so a renamed category reads correctly.
- There are no native `prompt()`, `confirm()` or `alert()` calls in the code: the browser is entitled not to show them, and inside an embedded viewer the call silently returns `null`. Dialogs are `useConfirm` and `usePrompt`.

## Review agents

Definitions live in `.claude/agents/`. Call them by name through `Agent`. Each
one reads this file as the source of truth and adds only its own checklist —
their content must not be copied back here, that is the same disease as two
implementations of one function.

| Agent | When to call it | The breakage it stands against |
|---|---|---|
| `product` | Before building anything new; any added screen, menu entry or setting | Tags and Tree were built, carried for weeks and then deleted — 1743 lines in one commit, for a feature neither the schedule nor the queue ever read |
| `frontend` | Any change to size, aspect ratio, overflow, scrolling, flex/grid, or a component's re-render | Seven commits fixed the same class: unequal tile heights, cropped covers, a 2:3 card rendering landscape, stack layers sized to the wrong box |
| `architect` | A new entity, column, or a second way to do the same thing | Path parsing existed twice and diverged; one node was called topic, deck, set and category |
| `migration` | Every migration and every query against a new column | `link_url` took down the queue; the default `area` kind hid every set; 0022 failed on a guard from 0021 |
| `design-system` | Any visual change | Twelve button padding variants; a control border at 1.24 contrast against a 3:1 requirement |
| `qa` | After any change to pure logic and before closing a milestone | Logic inside components was checked by nothing but hand testing |
| `ux` | A new screen, action or failure message | An empty queue looked like "everything is learned"; deleting was reachable only by right-click |
| `researcher` | Picking a library, asserting anything about someone else's API, any "as far as I remember" | A column was declared to exist from memory rather than from the database, and the queue fell over; Next 16 diverges from training data |
| `scientist` | The scheduler's numbers and any sentence about learning in the interface | The product's core is a memory algorithm, and "How it works" cites research publicly |

Reviewing agents do not edit — the main session edits, so the diff stays
visible. Only `qa` writes, and only tests.

`researcher` and `scientist` share a method but not an area: the first answers
"how is this actually built on the outside", the second only "is this claim
about memory justified". Their tasks never overlap: a graph layout choice never
goes to `scientist`, and the 0.90 retention target never goes to `researcher`.
Of the seven, `scientist` has the narrowest use — call it rarely, but do not
change the scheduler's numbers without it.

`frontend` and `design-system` both read stylesheets, and the line between
them is drawn on purpose: `design-system` decides **what value** — token,
colour, size, contrast — and `frontend` decides **how the box behaves with
it**. Neither judges the other's half. Without that line they would give
diverging advice, which is the disease agents are meant to cure.

There are deliberately no separate `ui`, `backend`, `devops`, `security` or
`analytics` agents. UI and the visual half of UX inspect the same files; split
across two agents they would diverge in their advice. Backend work here is
server actions over Supabase — its failures have been schema failures, and
those go to `migration`, or entity failures, which go to `architect`. The
infrastructure is Vercel and Supabase with no custom configuration, and RLS is
reviewed by `migration` together with the schema. There is no analytics in the
product and none planned, so an agent for it would review nothing.

To rebuild the set once the project changes: `docs/prompts/setup-agents.md`.

## Verification before committing

    npx tsc --noEmit
    npx eslint .
    npx vitest run
    npx next build

All four clean, or the work is not finished. Plus a live check of the affected
routes on `npx next dev`.

## Skills: what fits which task

Invoke through `Skill`, with no leading slash.

**Design and specification**
- `product-skills:product-manager-toolkit` — PRD edits, prioritisation, acceptance criteria
- `engineering-advanced-skills:spec-driven-workflow` — driving development from spec to tasks
- `product-skills:spec-to-repo` — expanding a spec into a repository structure

**Development**
- `engineering-skills:senior-fullstack` — Next.js scaffolding, project structure
- `engineering-skills:senior-frontend` — React/Next/Tailwind, responsiveness, accessibility, bundle size
- `engineering-skills:senior-backend` — server actions, authorisation, file uploads
- `engineering-advanced-skills:database-schema-designer` — schema, indexes, Supabase migrations
- `product-skills:ui-design-system` — tokens, components, one visual language

**Quality and release**
- `engineering-skills:senior-qa` — Jest + RTL, Playwright for the review scenario
- `engineering-advanced-skills:ci-cd-pipeline-builder` — pipeline and Vercel deployment
- `engineering-advanced-skills:env-secrets-manager` — Supabase keys, environment separation
- `engineering-advanced-skills:performance-profiler` — if session start exceeds 2.5 s
- `engineering-skills:senior-security` — auditing RLS and access policies before the first deploy

**Built-in commands**
- `/code-review` — review the diff before merging
- `/run` — start the app and check a change live
- `/simplify` — clean-up after a stage

## What the project does not have and will not

Audio or video on cards, shared decks, LLM card generation, native apps,
`.apkg` import, push notifications, gamification (streaks, points).

Duplicating a category, too. It resolves to one of two things and neither is
wanted: copies of the cards inside it, which the no-copies rule forbids
because two copies mean two review histories for one piece of knowledge; or an
empty shell, which is faster to create by hand than to explain.
