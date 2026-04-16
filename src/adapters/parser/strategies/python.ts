import type { Node } from "web-tree-sitter";
import type { SymbolKind } from "../../../domain/symbol.js";
import type { LanguageStrategy } from "./types.js";

export const pythonStrategy: LanguageStrategy = {
	mapKind(defKind: string): SymbolKind | null {
		switch (defKind) {
			case "class":
				return "class";
			case "function":
				return "function";
			case "constant":
				return "constant";
			default:
				return null;
		}
	},

	extractSignature(defNode: Node, source: string): string {
		const headNode = decoratedHead(defNode) ?? defNode;
		const body = defNode.childForFieldName("body");
		const end = body ? body.startIndex : defNode.endIndex;
		// Signature starts at headNode (includes decorators) and ends before body.
		return source.slice(headNode.startIndex, end).trimEnd();
	},

	extractDocstring(defNode: Node): string | undefined {
		const body = defNode.childForFieldName("body");
		if (!body) {
			return undefined;
		}
		const first = body.namedChildren.find((n) => n.type === "expression_statement");
		if (!first) {
			return undefined;
		}
		const str = first.namedChildren.find((n) => n.type === "string");
		if (!str) {
			return undefined;
		}
		// Extract inner text, strip quotes and """ triple quotes.
		const raw = str.text;
		const stripped = stripPythonString(raw);
		return firstLine(stripped);
	},

	isPrivate(name: string): boolean {
		return name.startsWith("_") && !(name.startsWith("__") && name.endsWith("__"));
	},

	isOverload(defNode: Node): boolean {
		const parent = defNode.parent;
		if (!parent || parent.type !== "decorated_definition") {
			return false;
		}
		for (const child of parent.namedChildren) {
			if (child.type !== "decorator") {
				continue;
			}
			const txt = child.text;
			if (/^@\s*overload\b/.test(txt) || /^@\s*typing\.overload\b/.test(txt)) {
				return true;
			}
		}
		return false;
	},
};

function decoratedHead(defNode: Node): Node | null {
	const parent = defNode.parent;
	if (parent && parent.type === "decorated_definition") {
		return parent;
	}
	return null;
}

function stripPythonString(raw: string): string {
	// Strip leading prefix (r, b, u, f, etc.)
	let s = raw.replace(/^[rRbBuUfF]{0,3}/, "");
	if (s.startsWith('"""') || s.startsWith("'''")) {
		s = s.slice(3, -3);
	} else if (s.startsWith('"') || s.startsWith("'")) {
		s = s.slice(1, -1);
	}
	return s.trim();
}

function firstLine(text: string): string {
	const idx = text.indexOf("\n");
	return (idx === -1 ? text : text.slice(0, idx)).trim();
}
