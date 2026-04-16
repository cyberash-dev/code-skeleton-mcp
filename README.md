# code-skeleton-mcp

MCP server that returns **code outlines** (classes, functions, signatures,
docstrings) instead of full file contents. On a 2000-line file, `get_outline`
typically produces ~80 lines of output — roughly **40x fewer tokens** than
reading the whole file with `Read`.

Supported languages out of the box: **Python, Go, TypeScript, JavaScript** (plus
TSX). Uses [tree-sitter](https://tree-sitter.github.io/) grammars compiled to
WebAssembly, so there is no native compilation step — it installs cleanly via
`npx` on macOS (Apple Silicon / Intel), Linux, and Windows.

## Tools

| Tool            | What it returns                                                                      |
|-----------------|--------------------------------------------------------------------------------------|
| `get_outline`   | File or directory outline: classes, methods, functions, constants, first-line docs. |
| `get_function`  | Source of a single function/method by dotted path (e.g. `User.greet`).               |
| `get_class`     | A class/interface/struct with method signatures (bodies optional).                   |
| `get_imports`   | Parsed imports with `isStdlib` / `isThirdParty` / `isRelative` flags and best-effort relative-path resolution. |

## Quick setup

One command wires the server into your AI tool **and** adds CLAUDE.md rules
that teach the agent when to prefer these tools over `Read`:

```bash
npx code-skeleton-mcp setup             # interactive, target: claude-code
npx code-skeleton-mcp setup --yes       # non-interactive
npx code-skeleton-mcp setup --dry-run   # preview only
npx code-skeleton-mcp setup --uninstall # clean removal
```

What it does for `--target claude-code`:
- Appends a rules block to `~/.claude/CLAUDE.md` (wrapped in
  `<!-- code-skeleton-mcp:rules:start/end -->` markers — re-runs update in
  place, `--uninstall` removes cleanly without touching anything else).
- Registers the server under `~/.claude.json` → `mcpServers["code-skeleton"]`
  as `npx -y code-skeleton-mcp` (other servers are preserved).

Flags:

| Flag            | Effect                                                           |
|-----------------|------------------------------------------------------------------|
| `--target <id>` | Comma-separated target IDs. Default `claude-code`. `all` → all.  |
| `--rules-only`  | Skip MCP registration.                                           |
| `--mcp-only`    | Skip CLAUDE.md rules.                                            |
| `--uninstall`   | Remove instead of install.                                       |
| `--dry-run`     | Preview paths and changes without writing.                       |
| `--yes`, `-y`   | Don't prompt for confirmation.                                   |

Currently supported targets: `claude-code`. Planned: `claude-desktop`,
`cursor`, `codex`, `qwen` — contributions welcome (each is one
`InstallTarget` class in `src/adapters/targets/`).

Restart your AI tool after setup; the four tools appear with the
`mcp__code-skeleton__` prefix.

## Install (without setup)

```bash
npm install -g code-skeleton-mcp
# or one-off:
npx code-skeleton-mcp outline path/to/file.py
```

Manual MCP entry (if you don't want to use `setup`):

```json
{
  "mcpServers": {
    "code-skeleton": {
      "command": "npx",
      "args": ["-y", "code-skeleton-mcp"]
    }
  }
}
```

## CLI

The same binary works as a CLI for debugging (JSON on stdout):

```bash
code-skeleton-mcp outline src/app.py --depth 2
code-skeleton-mcp outline src/ --recursive
code-skeleton-mcp function src/app.py User.greet
code-skeleton-mcp class src/app.ts User --bodies
code-skeleton-mcp imports src/app.ts
code-skeleton-mcp setup --dry-run
```

Run without arguments to start the MCP server on stdio.

## `get_outline` input

| Field                | Type     | Default | Notes                                              |
|----------------------|----------|---------|----------------------------------------------------|
| `path`               | string   | —       | File or directory.                                  |
| `max_depth`          | integer  | `2`     | Nesting depth of symbols returned.                  |
| `include_docstrings` | boolean  | `true`  | Include first line of docstrings / JSDoc / Go docs. |
| `include_private`    | boolean  | `false` | `_name`, Go lowercase, TS `private`.                |
| `recursive`          | boolean  | `false` | If `path` is a directory, walk subdirectories.      |

## Example

```bash
$ code-skeleton-mcp outline tests/fixtures/go/sample.go --depth 2
{
  "path": "tests/fixtures/go/sample.go",
  "language": "go",
  "symbols": [
    { "kind": "constant", "name": "MaxRetries", "line": 13, "signature": "const MaxRetries = 3",
      "docstring": "MaxRetries is the default retry cap." },
    { "kind": "struct", "name": "User", "line": 18, "signature": "User struct { ... }",
      "docstring": "User is a user record.",
      "children": [
        { "kind": "method", "name": "Greet", "line": 36, "signature": "func (u *User) Greet() string",
          "docstring": "Greet returns a greeting." }
      ] },
    ...
  ]
}
```

## Architecture

Vertical Slice + Hexagonal (Ports & Adapters).

- `src/domain/` — pure types: `CodeSymbol`, `Outline`, `ImportRef`, `Language`,
  domain errors. No external dependencies.
- `src/ports/` — `ParserPort`, `FileSystemPort`, `CachePort`,
  `InstallTarget`.
- `src/adapters/` — `tree-sitter` WASM parser (+ per-language strategies under
  `parser/strategies/`), Node `fs`, in-memory cache, install targets under
  `targets/`.
- `src/features/` — one vertical slice per MCP tool and per CLI feature:
  `schema.ts` (Zod) + `usecase.ts` (port orchestration) + `handler.ts` (MCP
  callback, when applicable).
- `src/composition-root.ts` — single wiring point.
- `src/mcp-server.ts` / `src/cli.ts` / `src/index.ts` — MCP stdio entry,
  CLI dispatcher, and the bin entry that routes between them.
- `wasm/` — precompiled tree-sitter grammars (committed, not fetched at install).
- `queries/` — upstream `tags.scm` + local augment queries per language.

Adding a new AI-tool target (Cursor, Codex, Qwen, Claude Desktop, …) is
one file in `src/adapters/targets/` implementing `InstallTarget`, plus one
line in `registry.ts`.

## Development

```bash
npm ci
npm run lint          # biome check src/ tests/ scripts/
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm run build         # tsc -p tsconfig.build.json
```

Refresh wasm grammars and upstream `tags.scm` (only when bumping grammar
versions):

```bash
npm run fetch-wasm
```

## License

MIT
