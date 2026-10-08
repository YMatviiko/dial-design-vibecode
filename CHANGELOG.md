# Changelog

Versioning (semver): **patch** = wording or validator bug fix · **minor** = new rule or check ·
**major** = a change that can block work that used to pass (e.g. a stricter validator).
Each entry notes the `@epam/ai-dial-ui-kit` version it was tested against.

## 1.0.1 — 2026-10-08
- Update check wording: stay completely silent when versions match or the check fails (live
  testing showed the agent reporting "you're on the latest version" and the failed check).
- Tested against `@epam/ai-dial-ui-kit` 0.14.2.

## 1.0.0 — 2026-10-08
- First versioned release. Rules 1–13, Setup Check, `validate.mjs` (1.0-component, unknown-component,
  raw-value errors; undocumented-prop warning), `composed-components.log.md` flow.
- Tested against `@epam/ai-dial-ui-kit` 0.14.2.
