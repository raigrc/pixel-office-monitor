<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project entrypoint

The five primary documents are [README.md](README.md), [PLAN.md](PLAN.md), [PRD](docs/PRD.md), [Architecture](docs/ARCHITECTURE.md), and [Design](docs/DESIGN.md). The character sprite reference and contact sheet support Design. [Archive inventory](docs/archive/2026-10-09/README.md) records historical paths and retention decisions.

Current product is a local observation monitor, not a provider session controller. Keep port 3001 and user-owned processes protected. Use loopback and an isolated verification server when needed. Browser-visible monitor tokens cannot authorize a privileged bridge. Do not print credentials or raw sensitive logs.

Phase 0 and read-only discovery are approved and checkpointed. The current authorized slice is read-only native-session selection and bounded message-history inspection on the confirmed plugin-free OpenCode connection. Keep discovery and history separate from monitor activity. Do not add provider prompting, execution, interruption, terminal attachment, other providers, renderer migration, or sprite uploads in this slice. Preserve user changes, live renderers, tests, generators, public assets, and external plugins. The original local Phase 4 differs from the new planned Phase 4. The main agent owns final verification and `decisions.tsv`.

Archived `.ts.txt` and `.tsx.txt` files are historical source, not modules to import. `graphify-out/` is a stale September 8 archival cache and is not authoritative for current source topology. Ignore rules do not untrack existing logs or screenshots.
