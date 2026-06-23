# AGENTS.md

This repository uses **Graphify** as its local AI-readable project map.

## Start-of-session checklist for AI agents

1. Read this file first.
2. Read `.github/copilot-instructions.md` for project quality rules, activation modes, tests, and review standards.
3. Read `graphify-out/graph.json` when you need architecture context.
4. Open `graphify-out/index.html` for the interactive graph viewer.
5. Open `graphify-out/wikipedia.html` or `graphify-out/wiki.md` for a wiki-style project overview.

## After making code changes

After any meaningful source, config, schema, or documentation change, regenerate Graphify:

```bash
node scripts/graphify-update.mjs .
```

This updates:

- `graphify-out/graph.json`
- `graphify-out/knowledge-graph.json`
- `graphify-out/index.html`
- `graphify-out/wikipedia.html`
- `graphify-out/wiki.md`
- `graphify-out/fingerprints.json`
- `graphify-out/meta.json`

## Canonical output folder

Use `graphify-out/` as the canonical graph folder. Do not recreate `.understand-anything/` unless the user explicitly asks for the older Understand plugin format.

## Notes

The graph updater uses the installed Understand/Graphify parser runtime at:

`C:/Users/jigne/.understand-anything-plugin`

If that plugin moves, set `UNDERSTAND_PLUGIN_ROOT` before running the update command.
