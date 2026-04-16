import type { Node } from "web-tree-sitter";
import type { SymbolKind } from "../../../domain/symbol.js";
import type { LanguageStrategy } from "./types.js";

export const typescriptStrategy: LanguageStrategy = {
	mapKind(defKind: string, defNode: Node, nameNode: Node): SymbolKind | null {
		switch (defKind) {
			case "class":
				return "class";
			case "interface":
				return "interface";
			case "method":
				return "method";
			case "function":
				return mapFunctionLike(defNode);
			case "constant":
				return "constant";
			case "enum":
				return "enum";
			case "type_alias":
				return "type-alias";
			case "module":
				return "class";
			default: {
				void nameNode;
				return null;
			}
		}
	},

	extractSignature(defNode: Node, source: string): string {
		const innerFn = findNestedFunctionLike(defNode);
		const body = innerFn?.childForFieldName("body") ?? defNode.childForFieldName("body");
		const end = body ? body.startIndex : defNode.endIndex;
		const raw = source.slice(defNode.startIndex, end);
		return raw.replace(/\s*=>?\s*$/u, "").trimEnd();
	},

	extractDocstring(defNode: Node, docNode: Node | null): string | undefined {
		if (docNode) {
			return extractJsDocFirstLine(docNode.text);
		}
		// Walk up through export_statement wrappers and take preceding comment.
		let target: Node = defNode;
		while (target.parent && target.parent.type === "export_statement") {
			target = target.parent;
		}
		let prev = target.previousSibling;
		while (prev && prev.type === "comment") {
			const doc = extractJsDocFirstLine(prev.text);
			if (doc) {
				return doc;
			}
			prev = prev.previousSibling;
		}
		return undefined;
	},

	isPrivate(name: string, defNode: Node): boolean {
		if (name.startsWith("#") || name.startsWith("_")) {
			return true;
		}
		for (const child of defNode.children) {
			if (child.type === "accessibility_modifier" && child.text === "private") {
				return true;
			}
		}
		return false;
	},

	isOverload(defNode: Node): boolean {
		// TS function overloads: adjacent function_declaration nodes with same name where
		// all but the last have no body.
		if (defNode.type === "function_declaration") {
			return defNode.childForFieldName("body") === null;
		}
		if (defNode.type === "function_signature") {
			return true;
		}
		if (defNode.type === "method_signature") {
			return true;
		}
		if (defNode.type === "abstract_method_signature") {
			return true;
		}
		return false;
	},
};

function mapFunctionLike(defNode: Node): SymbolKind {
	// JS tags.scm may capture a lexical_declaration whose value is an arrow function.
	// That's still a top-level function from the user's POV.
	if (isInsideClassBody(defNode)) {
		return "method";
	}
	return "function";
}

function isInsideClassBody(node: Node): boolean {
	let p: Node | null = node.parent;
	while (p) {
		if (p.type === "class_body") {
			return true;
		}
		if (p.type === "class_declaration" || p.type === "class") {
			return true;
		}
		if (p.type === "program" || p.type === "statement_block") {
			return false;
		}
		p = p.parent;
	}
	return false;
}

function findNestedFunctionLike(defNode: Node): Node | null {
	// For lexical_declaration / variable_declaration with arrow/function expression,
	// the actual body lives inside the declarator's value.
	if (defNode.type === "lexical_declaration" || defNode.type === "variable_declaration") {
		const declarator = defNode.namedChildren.find((n) => n.type === "variable_declarator");
		if (!declarator) {
			return null;
		}
		const value = declarator.childForFieldName("value");
		if (!value) {
			return null;
		}
		if (value.type === "arrow_function" || value.type === "function_expression") {
			return value;
		}
		return null;
	}
	if (defNode.type === "assignment_expression" || defNode.type === "pair") {
		const right = defNode.childForFieldName("right") ?? defNode.childForFieldName("value");
		if (right && (right.type === "arrow_function" || right.type === "function_expression")) {
			return right;
		}
		return null;
	}
	return null;
}

function extractJsDocFirstLine(raw: string): string | undefined {
	const text = raw.trim();
	if (!text.startsWith("/*") && !text.startsWith("//")) {
		return undefined;
	}
	if (text.startsWith("//")) {
		return text.replace(/^\/\/\s?/, "").trim() || undefined;
	}
	const inner = text.slice(2, text.endsWith("*/") ? -2 : undefined);
	const lines = inner
		.split("\n")
		.map((l) => l.replace(/^\s*\*\s?/, "").trim())
		.filter((l) => l.length > 0 && !l.startsWith("@"));
	return lines[0];
}
