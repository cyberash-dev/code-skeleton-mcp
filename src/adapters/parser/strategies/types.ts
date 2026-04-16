import type { Node } from "web-tree-sitter";
import type { SymbolKind } from "../../../domain/symbol.js";
import type { BuiltSymbol } from "../outline-builder.js";

export interface RegroupContext {
	roots: BuiltSymbol[];
	flat: BuiltSymbol[];
	reparent(child: BuiltSymbol, newParent: BuiltSymbol | null): void;
}

export interface LanguageStrategy {
	mapKind(defKind: string, defNode: Node, nameNode: Node): SymbolKind | null;
	extractSignature(defNode: Node, source: string): string;
	extractDocstring(defNode: Node, docNode: Node | null, source: string): string | undefined;
	isPrivate(name: string, defNode: Node): boolean;
	isOverload(defNode: Node): boolean;
	regroup?(ctx: RegroupContext): void;
}
