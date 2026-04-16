#!/usr/bin/env node
import { CLI_COMMANDS, runCli } from "./cli.js";
import { buildContainer } from "./composition-root.js";
import { runMcpServer } from "./mcp-server.js";
import { logger } from "./shared/logger.js";

async function main(): Promise<void> {
	const [, , ...argv] = process.argv;
	const first = argv[0];
	const container = buildContainer();

	if (first && (CLI_COMMANDS as readonly string[]).includes(first)) {
		const { exitCode } = await runCli(container, argv);
		process.exit(exitCode);
	}

	await runMcpServer(container);
}

main().catch((err) => {
	logger.error("fatal", err instanceof Error ? (err.stack ?? err.message) : err);
	process.exit(1);
});
