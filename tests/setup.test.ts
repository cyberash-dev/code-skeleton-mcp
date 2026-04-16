import { promises as fs } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ClaudeCodeTarget } from "../src/adapters/targets/claude-code.target.js";
import { buildTargetRegistry } from "../src/adapters/targets/registry.js";
import { getRuleBlock, hasBlock, removeBlock, upsertBlock } from "../src/features/setup/rules.js";
import { SetupUseCase } from "../src/features/setup/setup.usecase.js";

async function makeHome(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), "code-skeleton-setup-"));
}

describe("rules block", () => {
	it("inserts block into empty file", () => {
		const block = getRuleBlock();
		const out = upsertBlock("", block);
		expect(hasBlock(out, block)).toBe(true);
		expect(out).toContain(block.content);
	});

	it("appends block preserving existing content", () => {
		const block = getRuleBlock();
		const existing = "# My global notes\n\nHello.\n";
		const out = upsertBlock(existing, block);
		expect(out.startsWith("# My global notes")).toBe(true);
		expect(hasBlock(out, block)).toBe(true);
	});

	it("updates block in place on second run", () => {
		const block = getRuleBlock();
		const first = upsertBlock("preamble\n", block);
		const second = upsertBlock(first, block);
		expect(first).toBe(second);
		const changed = { ...block, content: "NEW CONTENT" };
		const third = upsertBlock(first, changed);
		expect(third).toContain("NEW CONTENT");
		expect(third).not.toContain(block.content);
	});

	it("removeBlock strips markers and content only", () => {
		const block = getRuleBlock();
		const existing = "preamble\n";
		const withBlock = upsertBlock(existing, block);
		const removed = removeBlock(withBlock, block);
		expect(removed).toContain("preamble");
		expect(hasBlock(removed, block)).toBe(false);
		expect(removed).not.toContain(block.content);
	});

	it("remove is a no-op when block is absent", () => {
		const block = getRuleBlock();
		const existing = "# just notes\n";
		expect(removeBlock(existing, block)).toBe(existing);
	});
});

describe("ClaudeCodeTarget", () => {
	let home: string;
	let target: ClaudeCodeTarget;

	beforeEach(async () => {
		home = await makeHome();
		target = new ClaudeCodeTarget(home);
	});

	it("applyRules creates CLAUDE.md with block", async () => {
		const res = await target.applyRules(getRuleBlock(), { dryRun: false });
		expect(res.changed).toBe(true);
		const content = await readFile(res.path, "utf8");
		expect(hasBlock(content, getRuleBlock())).toBe(true);
	});

	it("applyRules twice is idempotent", async () => {
		await target.applyRules(getRuleBlock(), { dryRun: false });
		const res = await target.applyRules(getRuleBlock(), { dryRun: false });
		expect(res.changed).toBe(false);
	});

	it("applyRules preserves existing CLAUDE.md content", async () => {
		const rulesPath = path.join(home, ".claude", "CLAUDE.md");
		await fs.mkdir(path.dirname(rulesPath), { recursive: true });
		await writeFile(rulesPath, "# User notes\n\nKeep me.\n");
		await target.applyRules(getRuleBlock(), { dryRun: false });
		const content = await readFile(rulesPath, "utf8");
		expect(content).toContain("# User notes");
		expect(content).toContain("Keep me.");
		expect(hasBlock(content, getRuleBlock())).toBe(true);
	});

	it("removeRules is idempotent when file missing", async () => {
		const res = await target.removeRules(getRuleBlock(), { dryRun: false });
		expect(res.changed).toBe(false);
	});

	it("removeRules keeps unrelated content", async () => {
		const rulesPath = path.join(home, ".claude", "CLAUDE.md");
		await fs.mkdir(path.dirname(rulesPath), { recursive: true });
		await writeFile(rulesPath, "# User notes\n");
		await target.applyRules(getRuleBlock(), { dryRun: false });
		const res = await target.removeRules(getRuleBlock(), { dryRun: false });
		expect(res.changed).toBe(true);
		const content = await readFile(rulesPath, "utf8");
		expect(content).toContain("# User notes");
		expect(hasBlock(content, getRuleBlock())).toBe(false);
	});

	it("applyMcp creates entry and preserves other servers", async () => {
		const cfgPath = path.join(home, ".claude.json");
		await writeFile(
			cfgPath,
			JSON.stringify(
				{
					numStartups: 5,
					mcpServers: { "other-server": { command: "node", args: ["x"] } },
				},
				null,
				2,
			),
		);
		const res = await target.applyMcp(
			"code-skeleton",
			{ command: "npx", args: ["-y", "code-skeleton-mcp"] },
			{ dryRun: false },
		);
		expect(res.changed).toBe(true);
		const cfg = JSON.parse(await readFile(cfgPath, "utf8"));
		expect(cfg.numStartups).toBe(5);
		expect(Object.keys(cfg.mcpServers)).toEqual(["other-server", "code-skeleton"]);
		expect(cfg.mcpServers["code-skeleton"].command).toBe("npx");
	});

	it("applyMcp is idempotent", async () => {
		const entry = { command: "npx", args: ["-y", "code-skeleton-mcp"] };
		await target.applyMcp("code-skeleton", entry, { dryRun: false });
		const res = await target.applyMcp("code-skeleton", entry, { dryRun: false });
		expect(res.changed).toBe(false);
	});

	it("removeMcp removes entry and keeps siblings", async () => {
		const cfgPath = path.join(home, ".claude.json");
		await writeFile(
			cfgPath,
			JSON.stringify(
				{
					mcpServers: {
						keep: { command: "node", args: ["x"] },
						"code-skeleton": { command: "npx", args: ["-y", "code-skeleton-mcp"] },
					},
				},
				null,
				2,
			),
		);
		const res = await target.removeMcp("code-skeleton", { dryRun: false });
		expect(res.changed).toBe(true);
		const cfg = JSON.parse(await readFile(cfgPath, "utf8"));
		expect(cfg.mcpServers).toEqual({ keep: { command: "node", args: ["x"] } });
	});

	it("dry-run does not write", async () => {
		const res = await target.applyRules(getRuleBlock(), { dryRun: true });
		expect(res.changed).toBe(true);
		await expect(readFile(res.path, "utf8")).rejects.toThrow();
	});
});

describe("SetupUseCase", () => {
	it("installs rules + mcp for claude-code target only", async () => {
		const home = await makeHome();
		const registry = {
			all: [new ClaudeCodeTarget(home)],
			get: (id: string) => (id === "claude-code" ? new ClaudeCodeTarget(home) : undefined),
			resolveIds: () => [new ClaudeCodeTarget(home)],
		};
		const useCase = new SetupUseCase(registry);
		const report = await useCase.execute({
			action: "install",
			targets: "claude-code",
			rules: true,
			mcp: true,
			dryRun: false,
		});
		expect(report.targets).toHaveLength(1);
		expect(report.targets[0]?.rules?.changed).toBe(true);
		expect(report.targets[0]?.mcp?.changed).toBe(true);
	});

	it("rejects unknown target", async () => {
		const registry = buildTargetRegistry();
		const useCase = new SetupUseCase(registry);
		await expect(
			useCase.execute({
				action: "install",
				targets: "does-not-exist",
				rules: true,
				mcp: true,
				dryRun: true,
			}),
		).rejects.toThrow(/Unknown target/);
	});
});
