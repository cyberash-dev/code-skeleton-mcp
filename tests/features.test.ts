import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildContainer } from "../src/composition-root.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, "fixtures");

describe("get-outline", () => {
	it("returns a single Outline for a file", async () => {
		const c = buildContainer();
		const out = await c.useCases.getOutline.execute({
			path: resolve(fixtures, "python/sample.py"),
			max_depth: 2,
			include_docstrings: true,
			include_private: false,
			recursive: false,
		});
		expect(Array.isArray(out)).toBe(false);
		if (Array.isArray(out)) {
			throw new Error("expected single outline");
		}
		expect(out.language).toBe("python");
		expect(out.symbols.length).toBeGreaterThan(0);
	});

	it("returns an array for a directory (non-recursive)", async () => {
		const c = buildContainer();
		const out = await c.useCases.getOutline.execute({
			path: resolve(fixtures, "python"),
			max_depth: 2,
			include_docstrings: true,
			include_private: false,
			recursive: false,
		});
		expect(Array.isArray(out)).toBe(true);
		if (!Array.isArray(out)) {
			throw new Error("expected array");
		}
		expect(out.length).toBeGreaterThan(0);
		expect(out[0]?.language).toBe("python");
	});

	it("uses the cache on repeated calls (no re-parse)", async () => {
		const c = buildContainer();
		const first = await c.useCases.getOutline.execute({
			path: resolve(fixtures, "python/sample.py"),
			max_depth: 2,
			include_docstrings: true,
			include_private: false,
			recursive: false,
		});
		const second = await c.useCases.getOutline.execute({
			path: resolve(fixtures, "python/sample.py"),
			max_depth: 2,
			include_docstrings: true,
			include_private: false,
			recursive: false,
		});
		expect(first).toBe(second);
	});
});

describe("get-function", () => {
	it("returns the body of a top-level function", async () => {
		const c = buildContainer();
		const res = await c.useCases.getFunction.execute({
			path: resolve(fixtures, "python/sample.py"),
			symbol: "top_level",
		});
		expect(res.variants).toHaveLength(1);
		expect(res.variants[0]?.code).toMatch(/def top_level/);
		expect(res.variants[0]?.docstring).toBe("Return x + y.");
	});

	it("resolves dotted path ClassName.method", async () => {
		const c = buildContainer();
		const res = await c.useCases.getFunction.execute({
			path: resolve(fixtures, "python/sample.py"),
			symbol: "User.greet",
		});
		expect(res.variants).toHaveLength(1);
		expect(res.variants[0]?.code).toMatch(/def greet\(self\)/);
	});

	it("returns multiple variants for Python @overload", async () => {
		const c = buildContainer();
		const res = await c.useCases.getFunction.execute({
			path: resolve(fixtures, "python/sample.py"),
			symbol: "parse",
		});
		expect(res.variants.length).toBeGreaterThanOrEqual(3);
	});

	it("finds Go method under receiver type", async () => {
		const c = buildContainer();
		const res = await c.useCases.getFunction.execute({
			path: resolve(fixtures, "go/sample.go"),
			symbol: "User.Greet",
		});
		expect(res.variants).toHaveLength(1);
		expect(res.variants[0]?.code).toMatch(/func \(u \*User\) Greet/);
	});

	it("throws SymbolNotFound for unknown", async () => {
		const c = buildContainer();
		await expect(() =>
			c.useCases.getFunction.execute({
				path: resolve(fixtures, "python/sample.py"),
				symbol: "does_not_exist",
			}),
		).rejects.toThrow(/SYMBOL_NOT_FOUND|not found/i);
	});
});

describe("get-class", () => {
	it("returns class signature and method signatures by default", async () => {
		const c = buildContainer();
		const res = await c.useCases.getClass.execute({
			path: resolve(fixtures, "typescript/sample.ts"),
			symbol: "User",
			include_bodies: false,
		});
		expect(res.signature).toMatch(/class User implements Greeter/);
		const names = res.methods.map((m) => m.name);
		expect(names).toContain("greet");
		expect(names).toContain("constructor");
		for (const m of res.methods) {
			expect(m.body).toBeUndefined();
		}
	});

	it("includes bodies when requested", async () => {
		const c = buildContainer();
		const res = await c.useCases.getClass.execute({
			path: resolve(fixtures, "typescript/sample.ts"),
			symbol: "User",
			include_bodies: true,
		});
		expect(res.methods.every((m) => typeof m.body === "string")).toBe(true);
	});

	it("works for a Go struct", async () => {
		const c = buildContainer();
		const res = await c.useCases.getClass.execute({
			path: resolve(fixtures, "go/sample.go"),
			symbol: "User",
			include_bodies: false,
		});
		expect(res.signature).toMatch(/User struct/);
		expect(res.methods.map((m) => m.name).sort()).toEqual(["Greet", "privateHelper"].sort());
	});
});

describe("get-imports", () => {
	it("resolves relative Python imports best-effort", async () => {
		const c = buildContainer();
		const res = await c.useCases.getImports.execute({
			path: resolve(fixtures, "python/sample.py"),
		});
		const modules = res.imports.map((i) => i.module);
		expect(modules).toContain("os");
		const rel = res.imports.find((i) => i.isRelative);
		expect(rel).toBeDefined();
	});

	it("returns typescript imports", async () => {
		const c = buildContainer();
		const res = await c.useCases.getImports.execute({
			path: resolve(fixtures, "typescript/sample.ts"),
		});
		expect(res.imports.length).toBeGreaterThan(0);
		const builtin = res.imports.find((i) => i.module === "node:fs/promises")!;
		expect(builtin.isStdlib).toBe(true);
	});
});
