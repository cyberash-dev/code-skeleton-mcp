import type { TargetRegistry } from "../../adapters/targets/registry.js";
import type { InstallTarget, McpServerEntry } from "../../ports/install-target.port.js";
import { getRuleBlock } from "./rules.js";

export type SetupAction = "install" | "uninstall";

export interface SetupInput {
	action: SetupAction;
	targets: string;
	rules: boolean;
	mcp: boolean;
	dryRun: boolean;
}

export interface SetupReport {
	action: SetupAction;
	targets: Array<{
		id: string;
		name: string;
		rules: { changed: boolean; path: string; preview?: string } | null;
		mcp: { changed: boolean; path: string; preview?: string } | null;
	}>;
}

const MCP_SERVER_NAME = "code-skeleton";

export const DEFAULT_MCP_ENTRY: McpServerEntry = {
	command: "npx",
	args: ["-y", "code-skeleton-mcp"],
};

export class SetupUseCase {
	constructor(private readonly registry: TargetRegistry) {}

	async execute(input: SetupInput): Promise<SetupReport> {
		const targets = this.registry.resolveIds(input.targets);
		const report: SetupReport = { action: input.action, targets: [] };
		for (const target of targets) {
			report.targets.push(await this.applyToTarget(target, input));
		}
		return report;
	}

	private async applyToTarget(
		target: InstallTarget,
		input: SetupInput,
	): Promise<SetupReport["targets"][number]> {
		const block = getRuleBlock();
		const rulesResult = input.rules
			? input.action === "install"
				? await target.applyRules(block, { dryRun: input.dryRun })
				: await target.removeRules(block, { dryRun: input.dryRun })
			: null;
		const mcpResult = input.mcp
			? input.action === "install"
				? await target.applyMcp(MCP_SERVER_NAME, DEFAULT_MCP_ENTRY, {
						dryRun: input.dryRun,
					})
				: await target.removeMcp(MCP_SERVER_NAME, { dryRun: input.dryRun })
			: null;
		return {
			id: target.id,
			name: target.name,
			rules: rulesResult,
			mcp: mcpResult,
		};
	}
}
