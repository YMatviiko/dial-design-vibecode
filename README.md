# dial-design-vibecode

Claude Code skill for building UI in strict compliance with `@epam/ai-dial-ui-kit`.

## Install (per project)

From your project root:

```bash
git clone <this-repo-url> .claude/skills/dial-design-vibecode
```

Restart Claude Code. The skill triggers when building UI, including in projects where the kit isn't installed yet. You can also run `/dial-design-vibecode` to load it explicitly.
On first use it sets up the kit's MCP server (`.mcp.json`) if missing, then asks for one restart.

Requires Node/npm and access to `@epam/ai-dial-ui-kit`.

## Update

```bash
git -C .claude/skills/dial-design-vibecode pull
```

## Releasing (maintainers)

1. Edit `SKILL.md` / `validate.mjs`. If you change `validate.mjs`, paste it verbatim into the
   `javascript` block at the end of `SKILL.md`.
2. Retest against the current `@epam/ai-dial-ui-kit`; note its version in the changelog.
3. Bump `VERSION` (patch = fix, minor = new rule/check, major = can block work that passed before)
   and add a `## x.y.z — date` entry to `CHANGELOG.md`.
4. `node check-release.mjs` — must print `OK`. It prints the commit/tag/push commands.
5. Tell the team to run `git -C .claude/skills/dial-design-vibecode pull` and restart Claude Code.
   To stay on a known release, check out a tag: `git -C .claude/skills/dial-design-vibecode checkout v1.0.0`.
