# Prompt: set up agents for this project

Use this to create the agent set from scratch, or to revisit it once the
project has changed. Copy everything below the rule into Claude Code.

It deliberately contains no list of agents. The list is an output, not an
input: roles are derived from what the project actually broke on. Otherwise
you get an org chart instead of a tool.

---

Analyse this project and set up subagents for it.

## Step 1. Audit, before a single line of code

Read `CLAUDE.md` and walk the history: `git log --oneline -40`, and inside the
commit messages, the paragraphs explaining WHY. Write down the real recurring
breakages — not "bugs happen" but "error class X occurred N times, here are the
commits".

Separately, look at what already exists: `.claude/agents/`, `CLAUDE.md`,
`tests/`, `supabase/migrations/`. Do not build a second structure beside an
existing one.

Report the error classes you found BEFORE proposing any agent.

## Step 2. Roles are derived from breakages

Every proposed agent must point at an error class from step 1. An agent with no
matching breakage is not created — name it in the report as rejected and explain
why it does not pay for itself here.

Do not split roles for completeness. Two agents with overlapping areas will
give diverging advice, which is exactly the disease agents are meant to cure.
If UI and UX inspect the same files, that is one agent.

Do not create an agent for something a built-in command or the linter already
does.

## Step 3. Rules live in one place

`CLAUDE.md` is loaded into every session, including agent sessions. Therefore:

- normative rules stay in `CLAUDE.md`;
- an agent file does NOT restate them; it references them and adds only what is
  specific to its role;
- duplicating a rule between `CLAUDE.md` and an agent file is the same mistake
  as two implementations of one function in code.

## Step 4. Agent files

`.claude/agents/<name>.md`, frontmatter:

```
---
name: <the name it is called by>
description: <when to call it — the orchestrator reads this to choose>
model: sonnet          # only if the job is narrow; otherwise omit and inherit
tools: Read, Grep, Glob, Bash        # a reviewer needs no more
---
```

Writing tools (`Write`, `Edit`) go only to agents whose role is to create files.
A reviewing agent advises; the main session edits, so the diff stays visible.

The body follows one shape, and every agent file uses it:

```
# <Name>

## Mission            one sentence, then "CLAUDE.md is normative"
## Owns               what this agent judges
## Does NOT own       what it must hand to another agent, named
## Why this agent exists
## <its checklist>
## Definition of done
## How to answer
```

`Owns` / `Does NOT own` is the part that keeps two agents from giving
diverging advice. Where two agents read the same files, both files must state
the line between them in the same words — `design-system` decides what value,
`frontend` decides how the box behaves with it.

`Why this agent exists` is a table of COMMITS, with the hash and what broke.
An agent with no such table has no evidence behind it and should not have been
created (step 2).

The checklist carries EXAMPLES FROM THIS PROJECT and numbers where they exist.
"Check the contrast" is useless. "WCAG requires 3:1, `--line` gives 1.24, here
is the formula" works.

`How to answer`: a finding is a fact, its cost, and the fix. Explicitly allow
"nothing to report" — an agent obliged to find something starts inventing.

Do NOT add `Tech Stack`, `Coding Rules` or `Permissions` sections. `CLAUDE.md`
already carries them and is loaded into every agent session; a second copy is
the same mistake as two implementations of one function.

## Step 5. Verify

Add a short section to `CLAUDE.md`: which agents exist and when to call them.

Confirm nothing broke: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`,
`npx next build`.

In the report, name: which agents you created and against which breakage each
one stands; which you rejected and why; what you added to `CLAUDE.md`.
