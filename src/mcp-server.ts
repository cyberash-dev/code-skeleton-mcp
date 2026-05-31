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

	const outline = makeGetOutlineHandler(container.useCases.getOutline);
	const fn = makeGetFunctionHandler(container.useCases.getFunction);
	const cls = makeGetClassHandler(container.useCases.getClass);
	const imports = makeGetImportsHandler(container.useCases.getImports);
	server.registerTool(outline.name, outline.config, outline.handler);
	server.registerTool(fn.name, fn.config, fn.handler);
	server.registerTool(cls.name, cls.config, cls.handler);
	server.registerTool(imports.name, imports.config, imports.handler);

	const tools = [outline, fn, cls, imports];

	const transport = new StdioServerTransport();
	await server.connect(transport);
	logger.info(`code-skeleton-mcp started with ${tools.length} tools`);
}

function getPackageVersion(): string {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const pkgPath = resolve(here, "..", "package.json");
		const pkg: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
		if (
			typeof pkg === "object" &&
			pkg !== null &&
			"version" in pkg &&
			typeof pkg.version === "string"
		) {
			return pkg.version;
		}
		return "0.0.0";
	} catch {
		return "0.0.0";
	}
}
