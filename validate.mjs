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
