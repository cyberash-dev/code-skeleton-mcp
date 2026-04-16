import type { Node } from "web-tree-sitter";
import type { Language } from "../../domain/language.js";
import type { ImportRef } from "../../domain/symbol.js";
import { parseSource } from "./runtime.js";

export async function extractImports(source: string, language: Language): Promise<ImportRef[]> {
	const tree = await parseSource(source, language);
	switch (language) {
		case "python":
			return extractPython(tree.rootNode, source);
		case "go":
			return extractGo(tree.rootNode, source);
		case "javascript":
		case "typescript":
		case "tsx":
			return extractJs(tree.rootNode, source);
		default: {
			const never: never = language;
			throw new Error(`No import extractor for ${never}`);
		}
	}
}

function extractPython(root: Node, source: string): ImportRef[] {
	const out: ImportRef[] = [];
	walk(root, (n) => {
		if (n.type !== "import_statement" && n.type !== "import_from_statement") {
			return;
		}
		const raw = source.slice(n.startIndex, n.endIndex);
		const line = n.startPosition.row + 1;
		if (n.type === "import_from_statement") {
			const moduleName = resolveFromModule(n);
			if (moduleName !== null) {
				out.push(classifyPython(raw, moduleName, line));
			}
		} else {
			for (const child of n.namedChildren) {
				if (child.type === "dotted_name") {
					out.push(classifyPython(raw, child.text, line));
				} else if (child.type === "aliased_import") {
					const nameNode = child.childForFieldName("name");
					if (nameNode) {
						out.push(classifyPython(raw, nameNode.text, line));
					}
				}
			}
		}
	});
	return out;
}

function resolveFromModule(node: Node): string | null {
	const moduleField = node.childForFieldName("module_name");
	if (moduleField) {
		if (moduleField.type === "dotted_name") {
			return moduleField.text;
		}
		if (moduleField.type === "relative_import") {
			return moduleField.text;
		}
	}
	// Fallback: inspect first named child.
	for (const c of node.namedChildren) {
		if (c.type === "dotted_name" || c.type === "relative_import") {
			return c.text;
		}
	}
	return null;
}

function classifyPython(raw: string, moduleName: string, line: number): ImportRef {
	const isRelative = moduleName.startsWith(".");
	const top = moduleName.split(".")[0] ?? moduleName;
	const isStdlib = !isRelative && PYTHON_STDLIB.has(top);
	const isThirdParty = !isRelative && !isStdlib;
	return { raw, module: moduleName, isStdlib, isThirdParty, isRelative, line };
}

function extractGo(root: Node, source: string): ImportRef[] {
	const out: ImportRef[] = [];
	walk(root, (n) => {
		if (n.type !== "import_declaration") {
			return;
		}
		// import_declaration contains either import_spec or import_spec_list (containing import_specs)
		const specs = n.descendantsOfType("import_spec");
		for (const spec of specs) {
			const pathNode =
				spec.childForFieldName("path") ??
				spec.namedChildren.find(
					(c) =>
						c.type === "interpreted_string_literal" || c.type === "raw_string_literal",
				);
			if (!pathNode) {
				continue;
			}
			const moduleName = unquote(pathNode.text);
			const raw = source.slice(spec.startIndex, spec.endIndex);
			out.push(classifyGo(raw, moduleName, spec.startPosition.row + 1));
		}
	});
	return out;
}

function classifyGo(raw: string, moduleName: string, line: number): ImportRef {
	const isRelative = false;
	const isStdlib = !moduleName.includes(".") || moduleName.startsWith("golang.org/x/");
	return {
		raw,
		module: moduleName,
		isStdlib: isStdlib && !moduleName.startsWith("golang.org/x/"),
		isThirdParty: !isStdlib || moduleName.startsWith("golang.org/x/"),
		isRelative,
		line,
	};
}

function extractJs(root: Node, source: string): ImportRef[] {
	const out: ImportRef[] = [];
	walk(root, (n) => {
		if (n.type === "import_statement") {
			const src =
				n.childForFieldName("source") ?? n.namedChildren.find((c) => c.type === "string");
			if (!src) {
				return;
			}
			const moduleName = unquote(src.text);
			out.push(
				classifyJs(
					source.slice(n.startIndex, n.endIndex),
					moduleName,
					n.startPosition.row + 1,
				),
			);
		} else if (n.type === "call_expression") {
			const fn = n.childForFieldName("function");
			if (!fn || fn.type !== "identifier" || fn.text !== "require") {
				return;
			}
			const args = n.childForFieldName("arguments");
			if (!args) {
				return;
			}
			const first = args.namedChildren[0];
			if (!first || first.type !== "string") {
				return;
			}
			out.push(
				classifyJs(
					source.slice(n.startIndex, n.endIndex),
					unquote(first.text),
					n.startPosition.row + 1,
				),
			);
		}
	});
	return out;
}

function classifyJs(raw: string, moduleName: string, line: number): ImportRef {
	const isRelative =
		moduleName.startsWith("./") ||
		moduleName.startsWith("../") ||
		moduleName === "." ||
		moduleName === "..";
	const isNodeBuiltin = moduleName.startsWith("node:") || NODE_STDLIB.has(moduleName);
	const isThirdParty = !isRelative && !isNodeBuiltin;
	return { raw, module: moduleName, isStdlib: isNodeBuiltin, isThirdParty, isRelative, line };
}

function walk(node: Node, visit: (n: Node) => void): void {
	visit(node);
	for (const child of node.children) {
		walk(child, visit);
	}
}

function unquote(text: string): string {
	const s = text.trim();
	if (
		(s.startsWith('"') && s.endsWith('"')) ||
		(s.startsWith("'") && s.endsWith("'")) ||
		(s.startsWith("`") && s.endsWith("`"))
	) {
		return s.slice(1, -1);
	}
	return s;
}

const PYTHON_STDLIB = new Set([
	"__future__",
	"abc",
	"argparse",
	"ast",
	"asyncio",
	"base64",
	"builtins",
	"collections",
	"concurrent",
	"contextlib",
	"copy",
	"csv",
	"ctypes",
	"dataclasses",
	"datetime",
	"decimal",
	"difflib",
	"dis",
	"email",
	"enum",
	"errno",
	"fcntl",
	"functools",
	"glob",
	"hashlib",
	"heapq",
	"hmac",
	"html",
	"http",
	"importlib",
	"inspect",
	"io",
	"ipaddress",
	"itertools",
	"json",
	"logging",
	"math",
	"multiprocessing",
	"numbers",
	"operator",
	"os",
	"pathlib",
	"pickle",
	"platform",
	"pprint",
	"queue",
	"random",
	"re",
	"shutil",
	"signal",
	"socket",
	"sqlite3",
	"ssl",
	"statistics",
	"string",
	"struct",
	"subprocess",
	"sys",
	"tempfile",
	"textwrap",
	"threading",
	"time",
	"timeit",
	"traceback",
	"types",
	"typing",
	"unittest",
	"urllib",
	"uuid",
	"warnings",
	"weakref",
	"xml",
	"zipfile",
	"zlib",
]);

const NODE_STDLIB = new Set([
	"assert",
	"async_hooks",
	"buffer",
	"child_process",
	"cluster",
	"console",
	"constants",
	"crypto",
	"dgram",
	"dns",
	"domain",
	"events",
	"fs",
	"http",
	"http2",
	"https",
	"inspector",
	"module",
	"net",
	"os",
	"path",
	"perf_hooks",
	"process",
	"punycode",
	"querystring",
	"readline",
	"repl",
	"stream",
	"string_decoder",
	"sys",
	"timers",
	"tls",
	"trace_events",
	"tty",
	"url",
	"util",
	"v8",
	"vm",
	"wasi",
	"worker_threads",
	"zlib",
]);
