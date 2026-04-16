# CLAUDE.md

Guidance for Claude Code when working on this repository.

## What this project is

`code-skeleton-mcp` is an MCP server that returns code outlines (classes,
functions, method signatures, first-line docstrings) instead of full file
contents. Four tools: `get_outline`, `get_function`, `get_class`,
`get_imports`. Supported languages: Python, Go, TypeScript, JavaScript,
TSX via `web-tree-sitter` (WASM). Same binary also runs as a CLI and as a
one-shot `setup` installer that wires the server into AI coding tools.

## Commands

- `npm test` — Vitest suite.
- `npx vitest run tests/setup.test.ts` — single file.
- `npx vitest -t "applyRules twice is idempotent"` — by test name.
- `npm run lint` / `lint:fix` / `format` — Biome (config in `biome.json`).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — emits to `dist/` via `tsconfig.build.json`, also
  chmod +x on the bin entry.
- `npm run fetch-wasm` — refreshes `wasm/*.wasm` and `queries/*.scm`
  from upstream grammar npm tarballs + GitHub raw. Only run when bumping
  grammar versions. Do NOT run on every dev cycle — the committed files
  are the source of truth shipped to npm.
- `npm run dev -- outline …` — run via `tsx` from `src/` (hot).
- `npm run prepublishOnly` — runs `build`; gate before `npm publish`.

## Architecture

Vertical Slice + Hexagonal (Ports & Adapters).

- **`src/domain/`** — pure TS. `CodeSymbol`, `Outline`, `ImportRef`,
  `Language` (type + `detectFromPath`), domain errors. No imports from
  outside `domain/`.
- **`src/ports/`** — interfaces only:
  - `ParserPort` — `parseOutline`, `parseImports`, `getSymbolBody`,
    `getClassDump`.
  - `FileSystemPort` — `readFile`, `stat`, `exists`, `listFiles`.
  - `CachePort<T>` — keyed by `{path, mtimeMs, size}`.
  - `InstallTarget` — `applyRules`/`removeRules`/`applyMcp`/`removeMcp` +
    `detect`/`status` for any AI-tool config target.
- **`src/adapters/`** — implementations of ports:
  - `parser/tree-sitter.adapter.ts` + `runtime.ts` (WASM init, query cache)
    + `outline-builder.ts` (AST → `BuiltSymbol` tree) +
    `strategies/{python,go,typescript}.ts` (language-specific kind
    mapping, signature extraction, docstring extraction, privacy rules,
    overload detection, regroup of Go methods under their receiver type).
  - `file-system/node-fs.adapter.ts`, `cache/in-memory.adapter.ts`.
  - `targets/claude-code.target.ts` + `registry.ts` — install targets.
- **`src/features/`** — one vertical slice per tool or CLI feature:
  `schema.ts` (Zod input) + `usecase.ts` (orchestrates ports) +
  `handler.ts` (MCP `CallToolResult` adapter, when the feature is an MCP
  tool). `setup/` is CLI-only and has no handler, but has its own
  `rules.ts` with the CLAUDE.md rules block.
- **`src/shared/`** — cross-cutting helpers (`logger` → stderr only,
  never stdout, because MCP stdio uses stdout for JSON-RPC).
- **`src/composition-root.ts`** — the only place adapters are
  instantiated and passed into use-cases. Changes here are rare.
- **`src/mcp-server.ts`** / **`cli.ts`** / **`index.ts`** — MCP registration,
  CLI dispatcher, bin entry that decides CLI vs MCP by `argv[2]`.

**Import rules:** `domain` sees nothing. `ports` depend only on `domain`.
`features/*/usecase.ts` depend on `ports` (not adapters). `adapters`
implement `ports` and live on the periphery. Wiring happens exclusively
in `composition-root.ts`.

## Parser layer specifics

- **Query strategy:** upstream `tags.scm` files per language are
  committed under `queries/`, augmented by local `*.local.scm` files for
  things upstream misses (Go `const`/`var`, JS `constructor` methods, TS
  `enum`/`type_alias`/namespace). The `runtime.ts` concatenates files
  per language — for TypeScript, `javascript.scm` is also loaded because
  tree-sitter-typescript extends the JS grammar.
- **Symbol kinds** map to `SymbolKind` in `domain/symbol.ts`. New kinds
  (e.g. for Rust, Java) require a new strategy under
  `adapters/parser/strategies/` + entry in `registry.ts`.
- **`BuiltSymbol`** carries a `node: Node` reference through the build
  pipeline. Do not leak `BuiltSymbol` into use-cases or domain — strip
  to `CodeSymbol` via `toDomain()` before returning from the outline
  builder public API.
- **Docstring extraction** differs per language. Python reads the first
  `expression_statement > string` inside the body. Go/TS/JS walk
  previous siblings looking for a `comment` node, including through
  `export_statement`/`type_declaration` wrappers where tags.scm's doc
  capture doesn't reach.

## Tests

Vitest, fixtures in `tests/fixtures/<lang>/sample.<ext>`. Each fixture
contains: top-level function, class with methods, nested class /
receiver method, private member, decorated / overloaded function (where
applicable), imports of stdlib / third-party / relative.

- `tests/outline-builder.test.ts` — per-language outline + imports.
- `tests/features.test.ts` — use-case tests through `buildContainer()`.
- `tests/setup.test.ts` — setup slice: rules block idempotency,
  `ClaudeCodeTarget` against a temp `$HOME`, preservation of unrelated
  content/other MCP servers.

Fixtures under `tests/fixtures/**` are **excluded** from biome (config
`files.includes`) and from tsc (via `tsconfig.json` exclude) because
they are deliberately "imperfect" code samples — linters must not
rewrite them. If a fixture import gets stripped by an `--unsafe` biome
pass, restore it manually.

## Conventions

- Code style enforced by Biome: tab indent width 4, line 100, double
  quotes, trailing commas, semicolons, `useBlockStatements` required.
- Tests override `noNonNullAssertion` + `noNonNullAssertedOptionalChain`
  off — `arr[0]!` is fine in assertions.
- One public class or handler per file. Helpers inside the same file
  are allowed if private.
- Naming (from user's global CLAUDE.md): classes/types PascalCase;
  query methods are nouns, commands are verbs, predicates are `is…?`
  (the `?` is conceptual — booleans are named `isX` / `hasX` /
  `canX`).
- No `spec/` directory — README is the closest thing to a spec, keep
  it in sync with the public CLI / MCP tool surface.

## Non-obvious things to know

- **stdout is reserved for MCP JSON-RPC** when `index.js` runs without
  CLI args. All logging must go through `src/shared/logger.ts` (stderr).
  Never `console.log` in the hot path.
- **`~/.claude.json` writes must preserve unrelated keys.** The
  `ClaudeCodeTarget` is careful to deep-merge `mcpServers` without
  clobbering the rest of the config (the user's file often has 50+
  top-level keys). Tests cover this.
- **WASM files are committed.** Do not add a `postinstall` that
  downloads them — that breaks offline installs and npx-over-slow-network
  UX. Use `npm run fetch-wasm` manually when bumping grammar versions.
- **MCP SDK version `1.29+`** uses `registerTool(name, config, cb)`
  with a Zod raw-shape `inputSchema` (we pass `schema.shape`). Do not
  pass a full `z.object(...)` — the SDK accepts it but the types flip
  to a different inferred shape.
- **Release flow:** push tag `vX.Y.Z` → `.github/workflows/release.yml`
  runs lint+typecheck+test+build+`npm publish --provenance` using
  `NPM_TOKEN` secret + OIDC (`id-token: write`). Do not publish
  manually unless the user explicitly asks.

## graphify

No graphify knowledge graph is maintained here yet. If one is added,
`/graphify` is the entry point (global setup).
