import type { Container } from "./composition-root.js";
import type { SetupAction, SetupReport } from "./features/setup/setup.usecase.js";

export interface CliResult {
	exitCode: number;
}

export async function runCli(container: Container, argv: string[]): Promise<CliResult> {
	const [command, ...rest] = argv;
	if (!command || command === "--help" || command === "-h" || command === "help") {
		printHelp();
		return { exitCode: command ? 0 : 1 };
	}
	try {
		switch (command) {
			case "outline":
				return await outlineCmd(container, rest);
			case "function":
				return await functionCmd(container, rest);
			case "class":
				return await classCmd(container, rest);
			case "imports":
				return await importsCmd(container, rest);
			case "setup":
				return await setupCmd(container, rest);
			default:
				process.stderr.write(`Unknown command: ${command}\n`);
				printHelp();
				return { exitCode: 1 };
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`${msg}\n`);
		return { exitCode: 1 };
	}
}

function printHelp(): void {
	process.stdout.write(`code-skeleton-mcp — code outline extractor

Usage:
  code-skeleton-mcp                               Start MCP server on stdio.
  code-skeleton-mcp outline <path> [--depth N] [--no-docstrings] [--private] [--recursive]
  code-skeleton-mcp function <path> <symbol>
  code-skeleton-mcp class <path> <symbol> [--bodies]
  code-skeleton-mcp imports <path>
  code-skeleton-mcp setup [--target <ids>] [--yes] [--rules-only] [--mcp-only] [--uninstall] [--dry-run]
  code-skeleton-mcp help

Output is always JSON on stdout (except 'setup', which prints human-readable
progress to stderr and a summary on stdout).

'setup' installs CLAUDE.md rules and registers the MCP server in supported AI
coding tools. Default target: claude-code. Use --target <ids> (comma-separated,
or "all") to pick multiple. Run --dry-run to preview without writing.
`);
}

async function outlineCmd(container: Container, args: string[]): Promise<CliResult> {
	const { positional, flags } = parseArgs(args);
	const target = positional[0];
	if (!target) {
		throw new Error("outline: <path> required");
	}
	const result = await container.useCases.getOutline.execute({
		path: target,
		max_depth: Number(flags.depth ?? flags["max-depth"] ?? 2),
		include_docstrings: flags["no-docstrings"] !== true,
		include_private: flags.private === true,
		recursive: flags.recursive === true,
	});
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	return { exitCode: 0 };
}

async function functionCmd(container: Container, args: string[]): Promise<CliResult> {
	const { positional } = parseArgs(args);
	const [target, symbol] = positional;
	if (!target || !symbol) {
		throw new Error("function: <path> <symbol> required");
	}
	const result = await container.useCases.getFunction.execute({ path: target, symbol });
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	return { exitCode: 0 };
}

async function classCmd(container: Container, args: string[]): Promise<CliResult> {
	const { positional, flags } = parseArgs(args);
	const [target, symbol] = positional;
	if (!target || !symbol) {
		throw new Error("class: <path> <symbol> required");
	}
	const result = await container.useCases.getClass.execute({
		path: target,
		symbol,
		include_bodies: flags.bodies === true,
	});
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	return { exitCode: 0 };
}

async function importsCmd(container: Container, args: string[]): Promise<CliResult> {
	const { positional } = parseArgs(args);
	const target = positional[0];
	if (!target) {
		throw new Error("imports: <path> required");
	}
	const result = await container.useCases.getImports.execute({ path: target });
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	return { exitCode: 0 };
}

interface ParsedArgs {
	positional: string[];
	flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === undefined) {
			continue;
		}
		if (a.startsWith("--")) {
			const key = a.slice(2);
			const next = args[i + 1];
			if (next !== undefined && !next.startsWith("--")) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = true;
			}
		} else {
			positional.push(a);
		}
	}
	return { positional, flags };
}

async function setupCmd(container: Container, args: string[]): Promise<CliResult> {
	const { flags } = parseArgs(args);
	const action: SetupAction = flags.uninstall === true ? "uninstall" : "install";
	const rulesOnly = flags["rules-only"] === true;
	const mcpOnly = flags["mcp-only"] === true;
	if (rulesOnly && mcpOnly) {
		throw new Error("setup: --rules-only and --mcp-only are mutually exclusive");
	}
	const targetSpec = typeof flags.target === "string" ? flags.target : "claude-code";
	const dryRun = flags["dry-run"] === true;
	const yes = flags.yes === true || flags.y === true || dryRun;

	const input = {
		action,
		targets: targetSpec,
		rules: !mcpOnly,
		mcp: !rulesOnly,
		dryRun: true,
	};

	const preview = await container.useCases.setup.execute(input);
	printSetupReport(preview, { dryRun });
	if (dryRun) {
		return { exitCode: 0 };
	}

	if (!yes && !(await confirm(`Apply changes above? [y/N] `))) {
		process.stderr.write("aborted\n");
		return { exitCode: 1 };
	}

	const applied = await container.useCases.setup.execute({ ...input, dryRun: false });
	process.stderr.write(action === "install" ? "installed\n" : "uninstalled\n");
	void applied;
	return { exitCode: 0 };
}

function printSetupReport(report: SetupReport, opts: { dryRun: boolean }): void {
	const verb = report.action === "install" ? "would install" : "would remove";
	const prefix = opts.dryRun ? `[dry-run] ${verb}` : verb;
	for (const target of report.targets) {
		process.stderr.write(`• ${target.name} (${target.id})\n`);
		if (target.rules) {
			const tag = target.rules.changed ? prefix : "already up-to-date:";
			process.stderr.write(`    rules  ${tag} ${target.rules.path}\n`);
		}
		if (target.mcp) {
			const tag = target.mcp.changed ? prefix : "already up-to-date:";
			process.stderr.write(`    mcp    ${tag} ${target.mcp.path}\n`);
		}
	}
}

async function confirm(prompt: string): Promise<boolean> {
	if (!process.stdin.isTTY) {
		return false;
	}
	process.stderr.write(prompt);
	const answer = await new Promise<string>((resolvePromise) => {
		const chunks: Buffer[] = [];
		const onData = (chunk: Buffer): void => {
			chunks.push(chunk);
			if (chunk.includes(0x0a)) {
				process.stdin.off("data", onData);
				resolvePromise(Buffer.concat(chunks).toString("utf8").trim());
			}
		};
		process.stdin.on("data", onData);
	});
	return /^y(es)?$/i.test(answer);
}

export const CLI_COMMANDS = [
	"outline",
	"function",
	"class",
	"imports",
	"setup",
	"help",
	"--help",
	"-h",
] as const;
