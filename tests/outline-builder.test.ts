import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractImports } from "../src/adapters/parser/imports.js";
import { buildOutline } from "../src/adapters/parser/outline-builder.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, "fixtures");

async function load(p: string): Promise<string> {
	return readFile(resolve(fixtures, p), "utf8");
}

describe("python outline", () => {
	it("captures top-level functions, classes, constants, methods, nested class", async () => {
		const src = await load("python/sample.py");
		const { symbols, warnings } = await buildOutline(src, "python", {
			includeDocstrings: true,
			includePrivate: false,
		});
		expect(warnings).toEqual([]);

		const names = symbols.map((s) => s.name);
		expect(names).toContain("top_level");
		expect(names).toContain("parse");
		expect(names).toContain("User");
		expect(names).toContain("MAX_RETRIES");
		expect(names).not.toContain("_INTERNAL_FLAG");
		expect(names).not.toContain("_module_private");

		const top = symbols.find((s) => s.name === "top_level")!;
		expect(top.kind).toBe("function");
		expect(top.signature).toMatch(/def top_level\(x: int, y: int = 0\) -> int:/);
		expect(top.docstring).toBe("Return x + y.");

		const user = symbols.find((s) => s.name === "User")!;
		expect(user.kind).toBe("class");
		expect(user.docstring).toBe("A user record.");
		const childNames = (user.children ?? []).map((c) => c.name);
		expect(childNames).toContain("__init__");
		expect(childNames).toContain("greet");
		expect(childNames).toContain("Meta");
		expect(childNames).not.toContain("_private");

		const init = user.children?.find((c) => c.name === "__init__")!;
		expect(init.kind).toBe("constructor");

		const greet = user.children?.find((c) => c.name === "greet")!;
		expect(greet.kind).toBe("method");
		expect(greet.docstring).toBe("Return a greeting.");

		const meta = user.children?.find((c) => c.name === "Meta")!;
		expect(meta.kind).toBe("class");
	});

	it("respects includePrivate", async () => {
		const src = await load("python/sample.py");
		const { symbols } = await buildOutline(src, "python", { includePrivate: true });
		const names = symbols.map((s) => s.name);
		expect(names).toContain("_module_private");
		expect(names).toContain("_INTERNAL_FLAG");
	});

	it("marks overloaded functions", async () => {
		const src = await load("python/sample.py");
		const { symbols } = await buildOutline(src, "python", {});
		const parseSymbols = symbols.filter((s) => s.name === "parse");
		expect(parseSymbols.length).toBeGreaterThanOrEqual(2);
		const hasOverload = parseSymbols.some((s) => s.isOverload);
		expect(hasOverload).toBe(true);
	});
});

describe("go outline", () => {
	it("captures package-level decls and methods under their receiver type", async () => {
		const src = await load("go/sample.go");
		const { symbols } = await buildOutline(src, "go", {
			includeDocstrings: true,
			includePrivate: true,
		});
		const names = symbols.map((s) => s.name);
		expect(names).toContain("User");
		expect(names).toContain("Greeter");
		expect(names).toContain("NewUser");
		expect(names).toContain("MaxRetries");

		const user = symbols.find((s) => s.name === "User")!;
		expect(user.kind).toBe("struct");
		expect(user.docstring).toBe("User is a user record.");
		const methods = (user.children ?? []).map((c) => c.name).sort();
		expect(methods).toContain("Greet");
		expect(methods).toContain("privateHelper");

		const greeter = symbols.find((s) => s.name === "Greeter")!;
		expect(greeter.kind).toBe("interface");
	});

	it("flags lowercase names as private", async () => {
		const src = await load("go/sample.go");
		const { symbols } = await buildOutline(src, "go", {
			includeDocstrings: true,
			includePrivate: true,
		});
		const user = symbols.find((s) => s.name === "User")!;
		const helper = (user.children ?? []).find((c) => c.name === "privateHelper")!;
		expect(helper.isPrivate).toBe(true);
	});
});

describe("typescript outline", () => {
	it("captures interface, class, methods, functions, arrow consts", async () => {
		const src = await load("typescript/sample.ts");
		const { symbols } = await buildOutline(src, "typescript", { includeDocstrings: true });
		const names = symbols.map((s) => s.name);
		expect(names).toContain("User");
		expect(names).toContain("Greeter");
		expect(names).toContain("topLevel");
		expect(names).toContain("arrowAdd");
		expect(names).toContain("UserID");

		const user = symbols.find((s) => s.name === "User")!;
		expect(user.kind).toBe("class");
		const childNames = (user.children ?? []).map((c) => c.name);
		expect(childNames).toContain("greet");
		expect(childNames).toContain("constructor");
		expect(childNames).not.toContain("_secret");

		const greeter = symbols.find((s) => s.name === "Greeter")!;
		expect(greeter.kind).toBe("interface");

		const userID = symbols.find((s) => s.name === "UserID")!;
		expect(userID.kind).toBe("type-alias");

		const topLevel = symbols.find((s) => s.name === "topLevel")!;
		expect(topLevel.kind).toBe("function");
		expect(topLevel.docstring).toBe("Top-level function.");
	});
});

describe("javascript outline", () => {
	it("captures class, methods, functions, arrow consts", async () => {
		const src = await load("javascript/sample.js");
		const { symbols } = await buildOutline(src, "javascript", { includeDocstrings: true });
		const names = symbols.map((s) => s.name);
		expect(names).toContain("User");
		expect(names).toContain("topLevel");
		expect(names).toContain("arrowAdd");

		const user = symbols.find((s) => s.name === "User")!;
		expect(user.kind).toBe("class");
		const childNames = (user.children ?? []).map((c) => c.name);
		expect(childNames).toContain("greet");
		expect(childNames).toContain("constructor");
	});
});

describe("imports extraction", () => {
	it("python", async () => {
		const src = await load("python/sample.py");
		const imports = await extractImports(src, "python");
		const modules = imports.map((i) => i.module);
		expect(modules).toContain("os");
		expect(modules).toContain("sys");
		expect(modules).toContain("typing");
		expect(modules).toContain("collections");
		expect(modules.some((m) => m.startsWith("."))).toBe(true);
		const os = imports.find((i) => i.module === "os")!;
		expect(os.isStdlib).toBe(true);
	});

	it("go", async () => {
		const src = await load("go/sample.go");
		const imports = await extractImports(src, "go");
		const modules = imports.map((i) => i.module);
		expect(modules).toContain("fmt");
		expect(modules).toContain("log");
		expect(modules).toContain("net/http");
		expect(modules).toContain("example.com/pkg/util");
		const fmt = imports.find((i) => i.module === "fmt")!;
		expect(fmt.isStdlib).toBe(true);
		const util = imports.find((i) => i.module === "example.com/pkg/util")!;
		expect(util.isThirdParty).toBe(true);
	});

	it("typescript", async () => {
		const src = await load("typescript/sample.ts");
		const imports = await extractImports(src, "typescript");
		const modules = imports.map((i) => i.module);
		expect(modules).toContain("node:fs/promises");
		expect(modules).toContain("node:buffer");
		expect(modules).toContain("node:path");
		expect(modules).toContain("./helpers.js");
		const rel = imports.find((i) => i.module === "./helpers.js")!;
		expect(rel.isRelative).toBe(true);
	});

	it("javascript with require", async () => {
		const src = await load("javascript/sample.js");
		const imports = await extractImports(src, "javascript");
		const modules = imports.map((i) => i.module);
		expect(modules).toContain("node:fs/promises");
		expect(modules).toContain("node:path");
	});
});
