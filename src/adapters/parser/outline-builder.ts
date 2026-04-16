import type { Node, Tree } from "web-tree-sitter";
import type { Language } from "../../domain/language.js";
import type { CodeSymbol, SymbolKind } from "../../domain/symbol.js";
import type { ParseOptions } from "../../ports/parser.port.js";
import { getQuery, parseSource } from "./runtime.js";
import { getStrategy } from "./strategies/registry.js";

export interface BuiltSymbol extends CodeSymbol {
	node: Node;
	children?: BuiltSymbol[];
}

export interface OutlineResult {
	tree: Tree;
	symbols: CodeSymbol[];
	built: BuiltSymbol[];
	warnings: string[];
}

export async function buildOutline(
	source: string,
	language: Language,
	opts: ParseOptions = {},
): Promise<OutlineResult> {
	const tree = await parseSource(source, language);
	const query = await getQuery(language);
	const strategy = getStrategy(language);

	const warnings: string[] = [];
	const lineCount = source.split("\n").length;
	if (lineCount > 50_000) {
		warnings.push(`Large file: ${lineCount} lines`);
	}

	const flatMap = new Map<number, BuiltSymbol>();

	for (const match of query.matches(tree.rootNode)) {
		let defNode: Node | null = null;
		let defKind: string | null = null;
		let nameNode: Node | null = null;
		let docNode: Node | null = null;
		for (const c of match.captures) {
			if (c.name.startsWith("definition.")) {
				if (!defNode) {
					defNode = c.node;
					defKind = c.name.slice("definition.".length);
				}
			} else if (c.name === "name") {
				if (!nameNode) {
					nameNode = c.node;
				}
			} else if (c.name === "doc") {
				if (!docNode) {
					docNode = c.node;
				}
			}
		}
		if (!defNode || !defKind || !nameNode) {
			continue;
		}
		if (flatMap.has(defNode.id)) {
			continue;
		}

		const mapped = strategy.mapKind(defKind, defNode, nameNode);
		if (!mapped) {
			continue;
		}

		const name = nameNode.text;
		const signature = strategy.extractSignature(defNode, source).trim();
		const docstring =
			opts.includeDocstrings === false
				? undefined
				: strategy.extractDocstring(defNode, docNode, source);
		const isPrivate = strategy.isPrivate(name, defNode);
		const isOverload = strategy.isOverload(defNode);

		flatMap.set(defNode.id, {
			kind: mapped,
			name,
			line: defNode.startPosition.row + 1,
			endLine: defNode.endPosition.row + 1,
			signature,
			docstring,
			isPrivate: isPrivate || undefined,
			isOverload: isOverload || undefined,
			node: defNode,
		});
	}

	const flat = [...flatMap.values()];
	const { roots, parentOf } = buildHierarchy(flat);
	strategy.regroup?.({
		roots,
		flat,
		reparent: (child, newParent) => reparent(child, newParent, roots, parentOf),
	});
	refineNestedKinds(roots);
	sortByLine(roots);

	const filtered = applyFilters(roots, opts);
	const symbols = toDomain(filtered);

	return { tree, symbols, built: filtered, warnings };
}

function buildHierarchy(flat: BuiltSymbol[]): {
	roots: BuiltSymbol[];
	parentOf: Map<BuiltSymbol, BuiltSymbol | null>;
} {
	const byId = new Map<number, BuiltSymbol>();
	for (const s of flat) {
		byId.set(s.node.id, s);
	}
	const roots: BuiltSymbol[] = [];
	const parentOf = new Map<BuiltSymbol, BuiltSymbol | null>();
	for (const s of flat) {
		let p: Node | null = s.node.parent;
		let parent: BuiltSymbol | null = null;
		while (p) {
			const maybe = byId.get(p.id);
			if (maybe && maybe !== s) {
				parent = maybe;
				break;
			}
			p = p.parent;
		}
		if (parent) {
			parent.children ??= [];
			parent.children.push(s);
		} else {
			roots.push(s);
		}
		parentOf.set(s, parent);
	}
	return { roots, parentOf };
}

function reparent(
	child: BuiltSymbol,
	newParent: BuiltSymbol | null,
	roots: BuiltSymbol[],
	parentOf: Map<BuiltSymbol, BuiltSymbol | null>,
): void {
	const current = parentOf.get(child) ?? null;
	if (current === newParent) {
		return;
	}
	if (current) {
		const arr = current.children;
		if (arr) {
			const idx = arr.indexOf(child);
			if (idx !== -1) {
				arr.splice(idx, 1);
			}
		}
	} else {
		const idx = roots.indexOf(child);
		if (idx !== -1) {
			roots.splice(idx, 1);
		}
	}
	if (newParent) {
		newParent.children ??= [];
		newParent.children.push(child);
	} else {
		roots.push(child);
	}
	parentOf.set(child, newParent);
}

function refineNestedKinds(roots: BuiltSymbol[]): void {
	const walk = (list: BuiltSymbol[], parent: BuiltSymbol | null): void => {
		for (const s of list) {
			if (
				parent &&
				(parent.kind === "class" || parent.kind === "interface" || parent.kind === "struct")
			) {
				if (s.kind === "function") {
					s.kind =
						s.name === "__init__" || s.name === "constructor"
							? "constructor"
							: "method";
				}
			}
			if (s.children) {
				walk(s.children, s);
			}
		}
	};
	walk(roots, null);
}

function sortByLine(list: BuiltSymbol[]): void {
	list.sort((a, b) => a.line - b.line);
	for (const s of list) {
		if (s.children) {
			sortByLine(s.children);
		}
	}
}

function applyFilters(roots: BuiltSymbol[], opts: ParseOptions): BuiltSymbol[] {
	const maxDepth = opts.maxDepth ?? 99;
	const includePrivate = opts.includePrivate === true;
	const walk = (list: BuiltSymbol[], depth: number): BuiltSymbol[] => {
		const out: BuiltSymbol[] = [];
		for (const s of list) {
			if (!includePrivate && s.isPrivate) {
				continue;
			}
			if (depth >= maxDepth) {
				const { children: _c, ...rest } = s;
				out.push({ ...rest, node: s.node });
			} else {
				const filtered: BuiltSymbol = { ...s };
				if (s.children) {
					filtered.children = walk(s.children, depth + 1);
				} else {
					delete filtered.children;
				}
				out.push(filtered);
			}
		}
		return out;
	};
	return walk(roots, 1);
}

function toDomain(list: BuiltSymbol[]): CodeSymbol[] {
	return list.map((s) => {
		const base: CodeSymbol = {
			kind: s.kind,
			name: s.name,
			line: s.line,
			endLine: s.endLine,
		};
		if (s.signature) {
			base.signature = s.signature;
		}
		if (s.docstring) {
			base.docstring = s.docstring;
		}
		if (s.isPrivate) {
			base.isPrivate = true;
		}
		if (s.isOverload) {
			base.isOverload = true;
		}
		if (s.children && s.children.length > 0) {
			base.children = toDomain(s.children);
		}
		return base;
	});
}

export type { SymbolKind };
