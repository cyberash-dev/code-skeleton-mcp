import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Container } from "./composition-root.js";
import { makeGetClassHandler } from "./features/get-class/get-class.handler.js";
import { makeGetFunctionHandler } from "./features/get-function/get-function.handler.js";
import { makeGetImportsHandler } from "./features/get-imports/get-imports.handler.js";
import { makeGetOutlineHandler } from "./features/get-outline/get-outline.handler.js";
import { logger } from "./shared/logger.js";

export async function runMcpServer(container: Container): Promise<void> {
	const server = new McpServer({
		name: "code-skeleton-mcp",
		version: getPackageVersion(),
	});

	const tools = [
		makeGetOutlineHandler(container.useCases.getOutline),
		makeGetFunctionHandler(container.useCases.getFunction),
		makeGetClassHandler(container.useCases.getClass),
		makeGetImportsHandler(container.useCases.getImports),
	];

	for (const tool of tools) {
		server.registerTool(tool.name, tool.config, tool.handler as never);
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);
	logger.info(`code-skeleton-mcp started with ${tools.length} tools`);
}

function getPackageVersion(): string {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const pkgPath = resolve(here, "..", "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}
