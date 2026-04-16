import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
	hasBlock,
	RULES_END_MARKER,
	RULES_START_MARKER,
	removeBlock,
	upsertBlock,
} from "../../features/setup/rules.js";
import type {
	ApplyResult,
	InstallTarget,
	McpServerEntry,
	RuleBlock,
	TargetStatus,
} from "../../ports/install-target.port.js";

export class ClaudeCodeTarget implements InstallTarget {
	readonly id = "claude-code";
	readonly name = "Claude Code CLI";

	private readonly rulesFile: string;
	private readonly mcpFile: string;

	constructor(home: string = homedir()) {
		this.rulesFile = path.join(home, ".claude", "CLAUDE.md");
		this.mcpFile = path.join(home, ".claude.json");
	}

	async detect(): Promise<boolean> {
		// Consider Claude Code configured if either file exists.
		return (await exists(this.rulesFile)) || (await exists(this.mcpFile));
	}

	async status(): Promise<TargetStatus> {
		const rulesContent = await readIfExists(this.rulesFile);
		const mcpEntry = await readMcpEntry(this.mcpFile, "code-skeleton");
		return {
			id: this.id,
			name: this.name,
			detected: await this.detect(),
			rulesPath: this.rulesFile,
			mcpConfigPath: this.mcpFile,
			rulesInstalled:
				rulesContent !== null &&
				hasBlock(rulesContent, {
					startMarker: RULES_START_MARKER,
					endMarker: RULES_END_MARKER,
					content: "",
				}),
			mcpInstalled: mcpEntry !== null,
		};
	}

	async applyRules(block: RuleBlock, opts: { dryRun: boolean }): Promise<ApplyResult> {
		const before = (await readIfExists(this.rulesFile)) ?? "";
		const after = upsertBlock(before, block);
		if (before === after) {
			return { changed: false, path: this.rulesFile };
		}
		if (!opts.dryRun) {
			await fs.mkdir(path.dirname(this.rulesFile), { recursive: true });
			await fs.writeFile(this.rulesFile, after, "utf8");
		}
		return { changed: true, path: this.rulesFile, preview: makeDiffPreview(before, after) };
	}

	async removeRules(block: RuleBlock, opts: { dryRun: boolean }): Promise<ApplyResult> {
		const before = await readIfExists(this.rulesFile);
		if (before === null) {
			return { changed: false, path: this.rulesFile };
		}
		const after = removeBlock(before, block);
		if (before === after) {
			return { changed: false, path: this.rulesFile };
		}
		if (!opts.dryRun) {
			await fs.writeFile(this.rulesFile, after, "utf8");
		}
		return { changed: true, path: this.rulesFile, preview: makeDiffPreview(before, after) };
	}

	async applyMcp(
		name: string,
		entry: McpServerEntry,
		opts: { dryRun: boolean },
	): Promise<ApplyResult> {
		const existing = await loadJson(this.mcpFile);
		const config = (existing ?? {}) as Record<string, unknown>;
		const servers = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
		const prev = servers[name];
		const sameEntry = prev !== undefined && JSON.stringify(prev) === JSON.stringify(entry);
		if (sameEntry) {
			return { changed: false, path: this.mcpFile };
		}
		servers[name] = entry;
		config.mcpServers = servers;
		if (!opts.dryRun) {
			await writeJson(this.mcpFile, config);
		}
		return { changed: true, path: this.mcpFile };
	}

	async removeMcp(name: string, opts: { dryRun: boolean }): Promise<ApplyResult> {
		const existing = await loadJson(this.mcpFile);
		if (existing === null) {
			return { changed: false, path: this.mcpFile };
		}
		const config = existing as Record<string, unknown>;
		const servers = config.mcpServers as Record<string, unknown> | undefined;
		if (!servers || !(name in servers)) {
			return { changed: false, path: this.mcpFile };
		}
		delete servers[name];
		if (!opts.dryRun) {
			await writeJson(this.mcpFile, config);
		}
		return { changed: true, path: this.mcpFile };
	}
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function readIfExists(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf8");
	} catch (err: unknown) {
		if (isNodeError(err) && err.code === "ENOENT") {
			return null;
		}
		throw err;
	}
}

async function loadJson(filePath: string): Promise<unknown> {
	const raw = await readIfExists(filePath);
	if (raw === null) {
		return null;
	}
	return JSON.parse(raw);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readMcpEntry(filePath: string, name: string): Promise<unknown> {
	const data = (await loadJson(filePath)) as Record<string, unknown> | null;
	if (!data) {
		return null;
	}
	const servers = data.mcpServers as Record<string, unknown> | undefined;
	return servers?.[name] ?? null;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
	return err instanceof Error && "code" in err;
}

function makeDiffPreview(before: string, after: string): string {
	const beforeLines = before.split("\n").length;
	const afterLines = after.split("\n").length;
	return `~${Math.abs(afterLines - beforeLines)} lines changed`;
}
