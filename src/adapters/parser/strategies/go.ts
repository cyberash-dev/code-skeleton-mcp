import type { Node } from "web-tree-sitter";
import type { SymbolKind } from "../../../domain/symbol.js";
import type { BuiltSymbol } from "../outline-builder.js";
import type { LanguageStrategy, RegroupContext } from "./types.js";

export const goStrategy: LanguageStrategy = {
	mapKind(defKind: string, defNode: Node): SymbolKind | null {
		switch (defKind) {
			case "function":
				return "function";
			case "method":
				return "method";
			case "type":
				return classifyTypeSpec(defNode);
			case "constant":
				return "constant";
			case "variable":
				return "variable";
			default:
				return null;
		}
	},

	extractSignature(defNode: Node, source: string): string {
		if (defNode.type === "type_spec") {
			return cleanSignature(source.slice(defNode.startIndex, defNode.endIndex));
		}
		const body = defNode.childForFieldName("body");
		const end = body ? body.startIndex : defNode.endIndex;
		return cleanSignature(source.slice(defNode.startIndex, end));
	},

	extractDocstring(defNode: Node, docNode: Node | null): string | undefined {
		if (docNode) {
			return parseGoDoc(docNode.text);
		}
		// type_spec has no doc capture (comment is before its type_declaration parent).
		let target: Node = defNode;
		while (
			target.parent &&
			(target.parent.type === "type_declaration" ||
				target.parent.type === "var_declaration" ||
				target.parent.type === "const_declaration")
		) {
			target = target.parent;
		}
		let prev = target.previousSibling;
		while (prev && prev.type === "comment") {
			const doc = parseGoDoc(prev.text);
			if (doc) {
				return doc;
			}
			prev = prev.previousSibling;
		}
		return undefined;
	},

	isPrivate(name: string): boolean {
		const first = name[0];
		if (!first) {
			return false;
		}
		return first === first.toLowerCase() && first !== first.toUpperCase();
	},

	isOverload(): boolean {
		return false;
	},

	regroup(ctx: RegroupContext): void {
		const typeSymbols = new Map<string, BuiltSymbol>();
		for (const s of ctx.flat) {
			if (s.kind === "struct" || s.kind === "interface" || s.kind === "class") {
				typeSymbols.set(s.name, s);
			}
		}
		for (const s of ctx.flat) {
			if (s.kind !== "method") {
				continue;
			}
			const recvTypeName = receiverTypeName(s.node);
			if (!recvTypeName) {
				continue;
			}
			const owner = typeSymbols.get(recvTypeName);
			if (!owner || owner === s) {
				continue;
			}
			ctx.reparent(s, owner);
		}
	},
};

function classifyTypeSpec(defNode: Node): SymbolKind {
	if (defNode.type !== "type_spec") {
		return "type-alias";
	}
	// child 'type' (field) — struct_type / interface_type / identifier (alias)
	const typeField = defNode.childForFieldName("type");
	if (!typeField) {
		return "type-alias";
	}
	if (typeField.type === "struct_type") {
		return "struct";
	}
	if (typeField.type === "interface_type") {
		return "interface";
	}
	return "type-alias";
}

function receiverTypeName(methodNode: Node): string | null {
	const recv = methodNode.childForFieldName("receiver");
	if (!recv) {
		return null;
	}
	// receiver is parameter_list with a single parameter_declaration
	const params = recv.namedChildren;
	for (const p of params) {
		// parameter_declaration: type can be type_identifier or pointer_type
		const typeField =
			p.childForFieldName("type") ?? p.namedChildren.find((c) => c.type !== "identifier");
		if (!typeField) {
			continue;
		}
		if (typeField.type === "type_identifier") {
			return typeField.text;
		}
		if (typeField.type === "pointer_type") {
			const inner = typeField.namedChildren.find((c) => c.type === "type_identifier");
			if (inner) {
				return inner.text;
			}
		}
	}
	return null;
}

function cleanSignature(text: string): string {
	return text.replace(/\s+$/u, "").trimEnd();
}

function parseGoDoc(text: string): string | undefined {
	const lines = text
		.split("\n")
		.map((l) =>
			l
				.replace(/^\s*\/\/\s?/, "")
				.replace(/^\s*\/\*\s?/, "")
				.replace(/\s?\*\/\s*$/, "")
				.trim(),
		)
		.filter((l) => l.length > 0);
	return lines[0];
}
