---
name: dial-design-vibecode
description: Generate/update UI in the current project in strict compliance with @epam/ai-dial-ui-kit — discovers real components via the kit's own MCP server, never invents components/props/tokens, never uses a 1.0 (Dial*) component, and runs a deterministic validator before showing any diff. Use whenever building, editing, or reviewing UI code that uses @epam/ai-dial-ui-kit, and also when starting or vibecoding new UI/frontend features in a project where the kit isn't installed yet — the Setup Check installs and configures it.
---

# DIAL Design Vibecode

You are helping an engineer build or modify UI in this project. Every visual element must come
from `@epam/ai-dial-ui-kit`. Use its MCP server — `searchEntity(entity, query?)` and
`getEntityDetails(entity, name?)` — to discover real components, hooks, props, tokens, and
typography. **Never use `rg`/`grep`/`find`/`ls` to discover components** — the kit's own docs
flag this as unreliable (misses examples, misses types, slower) and the MCP tools exist
specifically to replace it.

This file is the whole skill — a single markdown file. It self-bootstraps its own validator
script on first use (Setup Check, step 0 below), so dropping this one file into
`.claude/skills/dial-design-vibecode/SKILL.md` in any project is enough; nothing else needs to
be copied in by hand.

## Configuration (edit this once per project)

- **Design review contact**: Yuliia Matviiko (MS Teams) — receives
  `composed-components.log.md` for review (rule 11c). If this is ever blank or replaced with a
  placeholder when rule 11c fires, ask the engineer who to send it to instead of guessing or
  skipping it.

## Setup Check (runs once per session, before any component work)

-1. **Print the skill version.** Read `VERSION` next to this file and say "dial-design-vibecode
   vX.Y.Z" once, so any bug report names the version. If `VERSION` is missing, say "version
   unknown". Then, **only if** the network is available and this folder is a git clone, run
   `git -C <this skill folder> ls-remote --tags origin` (read-only, a few seconds at most) and
   compare the newest `vX.Y.Z` tag to `VERSION`. If a newer tag exists, tell the engineer once:
   "a newer version (vX.Y.Z) is available — run `git -C .claude/skills/dial-design-vibecode pull`
   and restart." Never pull it yourself, never block on this, and say nothing if the check fails
   or the versions match.
0. **Bootstrap the validator.** If `validate.mjs` doesn't already exist next to this file (i.e.
   at `.claude/skills/dial-design-vibecode/validate.mjs`), write it out verbatim from the
   "Validator script" section near the end of this file, then continue.
1. **Probe the MCP server.** Call `searchEntity("component", "button")`. If it returns real
   data, the server is live — skip straight to the rules/workflow below.
2. **If the tool isn't available or errors out**, check what's actually missing:
   - Is `@epam/ai-dial-ui-kit` installed in `node_modules`?
   - Is `@modelcontextprotocol/sdk` installed (optional peer dep, not auto-installed)?
   - Does `.mcp.json` have an `ai-dial-ui-kit` entry pointing at
     `./node_modules/@epam/ai-dial-ui-kit/dist/mcp-server.cjs`?
3. **Install/configure whatever's missing**, in order:
   - `npm install @epam/ai-dial-ui-kit @modelcontextprotocol/sdk`
   - Merge (never overwrite) an `ai-dial-ui-kit` entry into `.mcp.json` — create the file if it
     doesn't exist; other MCP servers may already be configured there if it does.
   - Add the kit's recommended MCP-usage instructions to `AGENTS.md`/`CLAUDE.md` if either
     exists and doesn't already have them. If neither file exists, skip this — don't invent one
     just for this.
4. **Report what you did, then stop and ask for a session restart.** `.mcp.json` loads at
   session start — a server added mid-session isn't callable until the session restarts. Do
   not attempt component mapping in the same session on the assumption it'll "probably work."
5. **If the install itself fails** (registry access, permissions, a merge conflict in an
   existing `.mcp.json`), stop and show the engineer the actual error.

## Non-negotiable rules

1. **Only use Generation 2.0 components — never a 1.0 (`Dial*`) component, under any
   circumstances, even one with no `supersededBy` entry.** Check `supersededBy` live via
   `getEntityDetails` — don't trust a hardcoded list of "1.0 components with no replacement,"
   it goes stale as the kit evolves (e.g. `Grid` and `Tabs` both shipped as 2.0 after once being
   1.0-only). Find the closest real 2.0 match via `searchEntity` and use it, including an
   imperfect fit, in preference to building anything new or reaching for a legacy component.
   Falling back to raw HTML is not a convenience shortcut; see rule 4.
2. **A feature need that only a 1.0 component covers (no 2.0 replacement exists at all) is
   treated exactly like "nothing fits" under rule 4** — never as permission to use the 1.0
   component anyway. For something as structurally complex as a file manager or data grid, a
   raw-HTML fallback is rarely a reasonable scope — if a token-compliant raw-HTML build isn't
   realistic, stop and ask the engineer (rule 6) rather than attempt a sprawling custom
   reimplementation or silently reach for the 1.0 component. This is a real capability gap until
   the kit ships a 2.0 version — don't paper over it.
3. Never invent a component, prop, hook, or token that `searchEntity`/`getEntityDetails`
   doesn't return, under any circumstances.
4. **Falling back to raw HTML is a last resort**, gated by two conditions that must _both_ hold:
   - no existing `ai-dial-ui-kit` component — even adapted or used imperfectly — can reasonably
     serve the need, AND
   - the missing piece is **crucial to the user flow succeeding**: without it, the user cannot
     complete the task, or the feature does not function. A cosmetic gap, a nicer-looking
     alternative, or a "this would look better" preference is never sufficient justification.
     (There is no sanctioned layer of DS primitives to assemble instead — the kit doesn't ship
     one. Token-compliant raw HTML, per rule 7, is the only fallback.)
5. If no component fits but the gap is **not** crucial (cosmetic/non-blocking), do **not** fall
   back to raw HTML. Use the closest existing component as the pragmatic substitute, or flag
   the gap and suggest simplifying the requirement to fit what the kit already offers.
6. Only stop and ask the engineer when a raw-HTML fallback is actually warranted (rule 4) but
   even the basic tokens needed to style it compliantly don't exist — that's a genuine DS gap,
   not something to paper over.
7. Never hardcode a raw color, spacing, or font value. Always reference a real token/utility
   class returned by `getEntityDetails("theming")`/`getEntityDetails("typography")` — this
   applies equally to raw-HTML fallback markup.
8. When unsure whether an existing component fits the use case, pull its full usage example via
   `getEntityDetails` before deciding it doesn't.
9. After generating or editing code, run the validator (below) against the diff before showing
   it to the engineer. Report pass/fail alongside the diff — never silently suppress a failure.
10. Whenever you fall back to raw HTML under rule 4, flag it inline in the diff as "not an
    `ai-dial-ui-kit` component — raw HTML (last resort: nothing fit, crucial to flow)" and
    silently append one row to `composed-components.log.md` (format below).
11. Mapping completeness is checked agent-side, at two points — **there is no git hook wired in
    for this**; it only holds while this skill is actually driving the commit. (If you want a
    stronger, mechanical guarantee, you can wire `validate.mjs --mode pre-commit` into a real
    git hook yourself — see the Usage comment in the validator script — but that's a per-project
    choice this skill doesn't make for you, since it touches shared repo tooling.)
    - **(a) Before committing** (cue: "let's commit," "commit this," "ready to commit" — or
      whenever you're about to run `git commit` yourself). Run `--mode pre-commit`, which
      checks exactly what's staged. Anything unmapped → stop and tell the engineer exactly
      what's unmapped; do not create the commit over an unresolved element.
    - **(b) Before a PR is created** (cue: "this is done," "ready to merge," "create the PR,"
      "finalize this"). Optionally re-run `--mode pre-pr` across the whole branch diff as a
      final safety net — only useful for catching a commit that happened outside this skill
      (a manual edit, another tool, a different session).
    - **(c) Design handoff — advisory only.** Once (b) is clean (or skipped), check the log for
      entries on this feature/branch. If any exist, advise sending
      `composed-components.log.md` to the design review contact configured above for review
      (never send it yourself, never block anything). If nothing was logged, say nothing.
12. On a **blank-page request** — a feature described before any code exists — map each
    anticipated UI element via `searchEntity` and present a Component Mapping Plan (existing
    component / likely raw-HTML fallback candidate / genuine gap) before generating anything.
    Nothing gets logged at this stage.
13. When pre-existing, non-skill-authored code fails to map to a real component, offer to fix
    it using the same decision tree (rules 1–6), logged with a `retrofit` tag. Present fixes as
    reviewable diffs grouped by file — never auto-apply in bulk. A violation the engineer
    declines stays open and keeps blocking the gate.

## Workflow

0. **Setup check** (above). Don't proceed until the probe succeeds.
1. **Blank page:** if the engineer describes a feature before writing any code, produce the
   Component Mapping Plan (rule 12) first.
2. Identify which components/tokens are likely involved.
3. Query `searchEntity("component", …)`.
   - Matching (even imperfect) 2.0 component → use it, pull its full usage example (rule 1,
     rule 8). A 1.0 result is never a valid match, even an imperfect one.
   - Nothing in 2.0 fits (including when only a 1.0 component covers it — rule 2) → judge
     criticality (rule 4):
     - Crucial + nothing fits → raw HTML styled with real tokens (rule 4), unless too
       structurally complex for raw HTML (rule 2) → stop and ask.
     - Not crucial → closest existing 2.0 component anyway, or flag + suggest simplifying
       (rule 5).
   - Fallback warranted but even the needed tokens don't exist → stop and ask (rule 6).
4. Pull full usage examples only for the components/tokens actually used in this task.
5. Generate/edit the code.
6. Run the validator:
   ```
   node .claude/skills/dial-design-vibecode/validate.mjs
   ```
7. Present the diff + validator result, including the "raw HTML — last resort" flag where
   applicable. If the validator failed, fix and re-run before presenting. If a fallback was
   used, append the log row (rule 10).
8. **Before committing** (you or the engineer), run:
   ```
   node .claude/skills/dial-design-vibecode/validate.mjs --mode pre-commit
   ```
   Fix anything unmapped before the commit happens (rule 11a).
9. **Before a PR is created**, optionally re-run:
   ```
   node .claude/skills/dial-design-vibecode/validate.mjs --mode pre-pr --base <your base branch>
   ```
   as a final safety net (rule 11b). Only then check the log and advise sending it to design.

## The log file: `composed-components.log.md` (repo root)

Append-only, one row per raw-HTML fallback, written automatically at fallback time (rule 10) —
the engineer never touches it. Create the file with this header if it doesn't exist yet:

```markdown
| Date | Feature/branch | Element | Location | Origin | Fallback markup used | Why last resort (nothing fit + crucial to flow) |
| ---- | -------------- | ------- | -------- | ------ | -------------------- | ----------------------------------------------- |
```

`Origin` is `fresh` (decided live, during normal development) or `retrofit` (an existing
non-kit element brought into compliance per rule 13).

## Reference material (pulled on demand via MCP, never preloaded)

- `searchEntity`/`getEntityDetails` for `component`, `hook`, `util`, `type`, `constant`
- `getEntityDetails("typography")` / `getEntityDetails("theming")` for tokens/utility classes

## Validator script

Write this out verbatim to `.claude/skills/dial-design-vibecode/validate.mjs` (Setup Check,
step 0) if that file doesn't already exist. Don't paraphrase or "improve" it while copying —
copy it byte-for-byte, then run it as instructed elsewhere in this file.

```javascript
#!/usr/bin/env node
// Minimal deterministic validator for the dial-design-vibecode skill.
// Checks changed .tsx/.jsx files against node_modules/@epam/ai-dial-ui-kit/dist/components-manifest.json.
// Two finding levels — only `error` fails the gate (exit 1); `warning` is printed but passes:
//   - any Dial* (1.0) component usage -> error (rule 1)
//   - a component imported from @epam/ai-dial-ui-kit that isn't in the manifest -> error (hallucination)
//   - a quoted hex color literal, or raw px inside a style={{}} block -> error (should be a token instead)
//   - a prop not in a component's manifest props[] -> warning, only when that list is non-empty.
//     Confirmed against the real manifest: ~27% of components (wrapper/variant components the
//     generator can't introspect, e.g. PrimaryButton) have an EMPTY props[] — that means
//     "unknown," not "zero valid props," so those are skipped entirely rather than flagged.
//     Even non-empty lists can miss real inherited/native props (e.g. Input's actual `value`),
//     so this stays a warning, not a hard block, until the manifest's prop data is more complete.
//
// Usage:
//   node validate.mjs                              # per-edit mode: working tree changes vs HEAD + untracked
//   node validate.mjs --mode pre-commit             # exactly what's staged (run this yourself before committing,
//                                                    #   or wire it into a real git hook for a mechanical guarantee)
//   node validate.mjs --mode pre-pr --base main      # optional final whole-branch safety net
//   node validate.mjs file1.tsx file2.tsx           # explicit file list, any mode

// No external parsing dependency on purpose: an earlier version used the `typescript`
// package's compiler API (ts.createSourceFile, etc.), but that API isn't guaranteed stable
// across whatever TypeScript version happens to be installed in an arbitrary host project —
// confirmed the hard way when TypeScript 7's package stopped exposing it from the main entry
// point at all. A hand-rolled scanner has less nuance but zero version risk, which matters
// more for something meant to be dropped into any project.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findUp(startDir, relPath) {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, relPath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const manifestPath = findUp(
  __dirname,
  'node_modules/@epam/ai-dial-ui-kit/dist/components-manifest.json',
);
if (!manifestPath) {
  console.error(
    'FAIL: could not find node_modules/@epam/ai-dial-ui-kit/dist/components-manifest.json above ' +
      __dirname,
  );
  console.error(
    'Is @epam/ai-dial-ui-kit installed? Run the Setup Check first.',
  );
  process.exit(1);
}
const repoRoot = manifestPath.slice(0, manifestPath.indexOf('node_modules'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const componentsByName = new Map(manifest.components.map((c) => [c.name, c]));

const args = process.argv.slice(2);
let mode = 'edit';
let base = 'main';
const explicitFiles = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode') mode = args[++i];
  else if (args[i] === '--base') base = args[++i];
  else explicitFiles.push(args[i]);
}

function git(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function targetFiles() {
  if (explicitFiles.length) return explicitFiles;
  if (mode === 'pre-commit') {
    return git('git diff --cached --name-only --diff-filter=ACM');
  }
  const untracked = git('git ls-files --others --exclude-standard');
  if (mode === 'pre-pr') {
    const branchDiff = git(`git diff --name-only ${base}...HEAD`);
    const working = git('git diff --name-only HEAD');
    return [...new Set([...branchDiff, ...working, ...untracked])];
  }
  const working = git('git diff --name-only HEAD');
  return [...new Set([...working, ...untracked])];
}

const files = targetFiles().filter((f) => /\.(tsx|jsx)$/.test(f));

function readContent(relPath) {
  if (mode === 'pre-commit' && !explicitFiles.length) {
    // Validate exactly what's about to be committed, not whatever else is sitting
    // unstaged in the working tree on top of it.
    try {
      return execSync(`git show :${relPath}`, {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    } catch {
      return null;
    }
  }
  const absPath = join(repoRoot, relPath);
  return existsSync(absPath) ? readFileSync(absPath, 'utf8') : null;
}

const ALWAYS_ALLOWED_ATTRS = new Set([
  'key',
  'ref',
  'className',
  'style',
  'children',
  'id',
  'title',
]);
const findings = [];

function addFinding(file, line, level, rule, message) {
  findings.push({ file, line, level, rule, message });
}

function lineOf(text, pos) {
  return text.slice(0, pos).split('\n').length;
}

function findKitImports(text) {
  // import { Button, Select as MySelect } from '@epam/ai-dial-ui-kit' (or a subpath import).
  const map = new Map(); // localName -> exportedName
  const importRe =
    /import\s*\{([^}]*)\}\s*from\s*['"]@epam\/ai-dial-ui-kit[^'"]*['"]/g;
  let m;
  while ((m = importRe.exec(text))) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim();
      if (!spec) continue;
      const asMatch = spec.match(/^(\S+)\s+as\s+(\S+)$/);
      if (asMatch) map.set(asMatch[2], asMatch[1]);
      else map.set(spec, spec);
    }
  }
  return map;
}

// Shared by every scanning loop below: at position `i` (not inside a string), skip past a
// `/* block */` or `// line` comment if one starts there. Returns the new index, or `i`
// unchanged if there's no comment at this position. JSX allows a bare block comment directly
// between attributes (no `{}` wrapper needed) — confirmed as a real false-positive source in
// production code, where every word in the comment was getting read as an attribute name.
function skipComment(text, i) {
  if (text[i] === '/' && text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2);
    return end === -1 ? text.length : end + 2;
  }
  if (text[i] === '/' && text[i + 1] === '/') {
    const end = text.indexOf('\n', i + 2);
    return end === -1 ? text.length : end;
  }
  return i;
}

function skipBalanced(text, i, openCh, closeCh) {
  // Walks past a {...} or similar region, respecting quotes, comments, and nesting, starting
  // at `i` positioned just after the opening character. Returns the index just after the match.
  let depth = 1;
  let quote = null;
  while (i < text.length && depth > 0) {
    if (!quote) {
      const after = skipComment(text, i);
      if (after !== i) {
        i = after;
        continue;
      }
    }
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh) depth--;
    i++;
  }
  return i;
}

function findJsxTags(text) {
  // Finds `<Name ...attrs...>` / `<Name ...attrs... />`, skipping TS generics like
  // `useRef<Foo>()` by requiring the character before `<` to not be an identifier char.
  const tags = [];
  const startRe = /<([A-Za-z][\w.]*)/g;
  let m;
  while ((m = startRe.exec(text))) {
    const before = text[m.index - 1];
    if (before && /[A-Za-z0-9_$]/.test(before)) continue;
    const name = m[1];
    let i = startRe.lastIndex;
    let quote = null;
    let closeAt = -1;
    while (i < text.length) {
      if (!quote) {
        const after = skipComment(text, i);
        if (after !== i) {
          i = after;
          continue;
        }
      }
      const ch = text[i];
      if (quote) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        i++;
        continue;
      }
      if (ch === '{') {
        i = skipBalanced(text, i + 1, '{', '}');
        continue;
      }
      if (ch === '>') {
        closeAt = i;
        break;
      }
      i++;
    }
    if (closeAt === -1) {
      startRe.lastIndex = text.length;
      continue;
    }
    const attrsText = text.slice(
      startRe.lastIndex,
      closeAt - (text[closeAt - 1] === '/' ? 1 : 0),
    );
    tags.push({ name, start: m.index, attrsText });
    startRe.lastIndex = closeAt + 1;
  }
  return tags;
}

function extractAttrs(attrsText) {
  const names = [];
  let hasSpread = false;
  let i = 0;
  let quote = null;
  while (i < attrsText.length) {
    if (!quote) {
      const after = skipComment(attrsText, i);
      if (after !== i) {
        i = after;
        continue;
      }
    }
    const ch = attrsText[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === '{') {
      if (attrsText.slice(i, i + 4) === '{...') hasSpread = true;
      i = skipBalanced(attrsText, i + 1, '{', '}');
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const idMatch = attrsText.slice(i).match(/^[A-Za-z_][\w-]*/);
      names.push(idMatch[0]);
      i += idMatch[0].length;
      continue;
    }
    i++;
  }
  return { names, hasSpread };
}

function checkFile(relPath) {
  const text = readContent(relPath);
  if (text === null) return;

  const kitLocalNames = findKitImports(text);

  for (const tag of findJsxTags(text)) {
    const line = lineOf(text, tag.start);

    if (/^Dial[A-Z]/.test(tag.name)) {
      addFinding(
        relPath,
        line,
        'error',
        'no-1.0-components',
        `"${tag.name}" is a Generation 1.0 component — out of scope, use its 2.0 replacement or treat as a capability gap (rule 1/2).`,
      );
      continue;
    }
    if (!kitLocalNames.has(tag.name)) continue;

    const exportedName = kitLocalNames.get(tag.name);
    const entry = componentsByName.get(exportedName);
    if (!entry) {
      addFinding(
        relPath,
        line,
        'error',
        'unknown-component',
        `"${tag.name}" (imported as "${exportedName}" from @epam/ai-dial-ui-kit) is not in the manifest — possible hallucination.`,
      );
      continue;
    }
    // Skip entirely when the manifest has no documented props for this component (confirmed
    // against the real manifest: ~27% of components have an empty props[] — wrapper/variant
    // components the generator couldn't introspect, e.g. PrimaryButton, GhostIconButton — an
    // empty list there means "unknown," not "zero valid props." Flagging real, shipping props
    // on those would be a false positive, not a catch.
    if (entry.props.length === 0) continue;
    const { names: attrNames, hasSpread } = extractAttrs(tag.attrsText);
    if (hasSpread) continue; // can't statically verify props past a spread
    const validProps = new Set(entry.props.map((p) => p.name));
    for (const attrName of attrNames) {
      if (ALWAYS_ALLOWED_ATTRS.has(attrName)) continue;
      if (
        attrName.startsWith('data-') ||
        attrName.startsWith('aria-') ||
        /^on[A-Z]/.test(attrName)
      )
        continue;
      if (!validProps.has(attrName)) {
        // Warning, not error: even non-empty prop lists can miss inherited/native props the
        // generator didn't resolve (e.g. Input's real `value`/`placeholder` aren't in its
        // manifest entry either) — confirmed against real shipping code, so this isn't
        // reliable enough to hard-block a commit on its own.
        addFinding(
          relPath,
          line,
          'warning',
          'undocumented-prop',
          `"${attrName}" is not a documented prop of "${tag.name}" (Generation ${entry.generation}) — may be a real prop the manifest doesn't capture, or may be invented. Verify with getEntityDetails.`,
        );
      }
    }
  }

  // Real hex-color literals are always the entire content of a quoted string (JS/CSS
  // convention) and exactly 3, 4, 6, or 8 digits long — matching anything looser flags things
  // like "issue #8754" in a comment, confirmed as the dominant false positive in real code.
  const hexRe =
    /(['"`])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\1/g;
  let m;
  while ((m = hexRe.exec(text))) {
    addFinding(
      relPath,
      lineOf(text, m.index),
      'error',
      'raw-token-value',
      `Raw hex color "#${m[2]}" — reference a real token via getEntityDetails("theming") instead.`,
    );
  }
  const styleBlockRe = /style=\{\{([^}]*)\}\}/g;
  while ((m = styleBlockRe.exec(text))) {
    const pxRe = /(['"`:]\s*)(\d+(?:\.\d+)?)px/g;
    let pm;
    while ((pm = pxRe.exec(m[1]))) {
      addFinding(
        relPath,
        lineOf(text, m.index),
        'error',
        'raw-token-value',
        `Raw "${pm[2]}px" inline style literal — reference a real spacing token instead.`,
      );
    }
  }
}

for (const f of files) checkFile(f);

console.log(
  `dial-design-vibecode validator — mode: ${mode}${mode === 'pre-pr' ? ` (base: ${base})` : ''}`,
);
if (mode === 'pre-commit')
  console.log('checking staged content exactly as it will be committed');
console.log(
  `manifest: ${manifestPath} (generated ${manifest.generatedAt}, ${manifest.components.length} components)`,
);
console.log(`files checked: ${files.length}`);
if (!files.length) {
  console.log('No .tsx/.jsx files in scope. PASS (nothing to check).');
  process.exit(0);
}

if (!findings.length) {
  console.log('PASS — no violations found.');
  process.exit(0);
}

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warning');

if (warnings.length) {
  console.log(
    `\n${warnings.length} warning(s) — not blocking, but worth a look:\n`,
  );
  for (const f of warnings) {
    console.log(`  ${f.file}:${f.line} [${f.rule}] ${f.message}`);
  }
}

if (!errors.length) {
  console.log(
    "\nPASS — no blocking violations (warnings above, if any, don't fail the gate).",
  );
  process.exit(0);
}

console.log(`\nFAIL — ${errors.length} error(s):\n`);
for (const f of errors) {
  console.log(`  ${f.file}:${f.line} [${f.rule}] ${f.message}`);
}
process.exit(1);
```
