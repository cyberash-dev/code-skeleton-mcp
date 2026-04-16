export interface RuleBlock {
	startMarker: string;
	endMarker: string;
	content: string;
}

export interface McpServerEntry {
	command: string;
	args: string[];
}

export interface TargetStatus {
	id: string;
	name: string;
	detected: boolean;
	rulesPath: string;
	mcpConfigPath: string;
	rulesInstalled: boolean;
	mcpInstalled: boolean;
}

export interface ApplyResult {
	changed: boolean;
	path: string;
	preview?: string;
}

export interface InstallTarget {
	readonly id: string;
	readonly name: string;

	detect(): Promise<boolean>;
	status(): Promise<TargetStatus>;

	applyRules(block: RuleBlock, opts: { dryRun: boolean }): Promise<ApplyResult>;
	removeRules(block: RuleBlock, opts: { dryRun: boolean }): Promise<ApplyResult>;

	applyMcp(name: string, entry: McpServerEntry, opts: { dryRun: boolean }): Promise<ApplyResult>;
	removeMcp(name: string, opts: { dryRun: boolean }): Promise<ApplyResult>;
}
