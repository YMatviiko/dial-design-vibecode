#!/usr/bin/env node
// Maintainer check — run before every release:  node check-release.mjs
// Fails (exit 1) if:
//   - the validator embedded in SKILL.md differs from validate.mjs (the two must stay byte-identical)
//   - VERSION is not semver, or CHANGELOG.md has no entry for it
//   - SKILL.md's printed-version line doesn't mention the VERSION file
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(dir, f), 'utf8');
const problems = [];

const skill = read('SKILL.md');
const embedded = skill.match(/```javascript\n([\s\S]*?)\n```/)?.[1];
if (embedded === undefined) problems.push('SKILL.md has no ```javascript validator block.');
else if (embedded !== read('validate.mjs').replace(/\n+$/, ''))
  problems.push('Validator embedded in SKILL.md differs from validate.mjs — copy validate.mjs into the block verbatim.');

const version = read('VERSION').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`VERSION "${version}" is not semver (x.y.z).`);
else if (!new RegExp(`^## ${version.replace(/\./g, '\\.')} — `, 'm').test(read('CHANGELOG.md')))
  problems.push(`CHANGELOG.md has no "## ${version} — <date>" entry.`);

if (!/`VERSION`/.test(skill)) problems.push('SKILL.md does not tell the agent to read/print the VERSION file.');

if (problems.length) {
  console.log('NOT READY TO RELEASE:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
console.log(`OK — version ${version}; embedded validator matches; changelog entry present.`);
console.log(`Next: git add -A && git commit -m "Release v${version}" && git tag v${version} && git push && git push origin v${version}`);
