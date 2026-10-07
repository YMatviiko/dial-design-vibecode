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
