import type { RuleBlock } from "../../ports/install-target.port.js";

export const RULES_START_MARKER = "<!-- code-skeleton-mcp:rules:start -->";
export const RULES_END_MARKER = "<!-- code-skeleton-mcp:rules:end -->";

export const RULES_CONTENT = `## Code exploration (code-skeleton-mcp)

When exploring unfamiliar code, prefer these MCP tools over \`Read\`:

- \`mcp__code-skeleton__get_outline\` — structural skeleton of a file or
  directory (classes, functions, method signatures, first-line docs).
  **Default choice** when reading to *understand what's in a file* rather
  than to edit it.
- \`mcp__code-skeleton__get_function\` — body of one function or method by
  dotted path (e.g. \`ClassName.method\`, \`outer.inner.fn\`). Returns all
  \`variants[]\` for Python \`@overload\`.
- \`mcp__code-skeleton__get_class\` — class / interface / struct with method
  signatures (pass \`include_bodies: true\` for full bodies).
- \`mcp__code-skeleton__get_imports\` — imports with \`isStdlib\` /
  \`isThirdParty\` / \`isRelative\` flags and best-effort path resolution.

Decision rule:
- File > 200 lines AND goal is to understand structure → start with
  \`get_outline\`, not \`Read\`.
- Need exactly one function body → \`get_function\` instead of \`Read\` with
  offset/limit.
- About to edit → use \`Read\` (\`Edit\` needs exact line content).
- File < 100 lines → \`Read\` is fine, outline adds little.

Supported languages: Python, Go, TypeScript, JavaScript, TSX. Other
languages fall back to \`Read\`.`;

export function getRuleBlock(): RuleBlock {
	return {
		startMarker: RULES_START_MARKER,
		endMarker: RULES_END_MARKER,
		content: RULES_CONTENT,
	};
}

/** Return updated file content with the block inserted or updated. */
export function upsertBlock(fileContent: string, block: RuleBlock): string {
	const { startMarker, endMarker, content } = block;
	const wrapped = `${startMarker}\n${content}\n${endMarker}`;
	if (fileContent.includes(startMarker) && fileContent.includes(endMarker)) {
		const pattern = buildBlockRegex(startMarker, endMarker);
		return fileContent.replace(pattern, wrapped);
	}
	const trimmed = fileContent.replace(/\s+$/u, "");
	const prefix = trimmed.length === 0 ? "" : `${trimmed}\n\n`;
	return `${prefix}${wrapped}\n`;
}

/** Return updated content with the block removed (if present). */
export function removeBlock(fileContent: string, block: RuleBlock): string {
	const { startMarker, endMarker } = block;
	if (!fileContent.includes(startMarker) || !fileContent.includes(endMarker)) {
		return fileContent;
	}
	const pattern = buildBlockRegex(startMarker, endMarker);
	const next = fileContent.replace(pattern, "").replace(/\n{3,}/g, "\n\n");
	return next.replace(/\s+$/u, "\n");
}

export function hasBlock(fileContent: string, block: RuleBlock): boolean {
	return fileContent.includes(block.startMarker) && fileContent.includes(block.endMarker);
}

function buildBlockRegex(startMarker: string, endMarker: string): RegExp {
	const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`, "g");
}
