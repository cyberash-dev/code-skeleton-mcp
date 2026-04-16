import type { Language } from "./language.js";

export type SymbolKind =
	| "class"
	| "interface"
	| "struct"
	| "enum"
	| "type-alias"
	| "function"
	| "method"
	| "constructor"
	| "property"
	| "variable"
	| "constant";

export interface CodeSymbol {
	kind: SymbolKind;
	name: string;
	line: number;
	endLine: number;
	signature?: string;
	docstring?: string;
	isOverload?: boolean;
	isPrivate?: boolean;
	children?: CodeSymbol[];
}

export interface ImportRef {
	raw: string;
	module: string;
	isStdlib: boolean;
	isThirdParty: boolean;
	isRelative: boolean;
	resolvedPath?: string;
	line: number;
}

export interface Outline {
	path: string;
	language: Language;
	symbols: CodeSymbol[];
	warnings?: string[];
}

export interface FunctionBody {
	code: string;
	startLine: number;
	endLine: number;
	signature: string;
	docstring?: string;
}

export interface ClassDump {
	name: string;
	startLine: number;
	endLine: number;
	signature: string;
	docstring?: string;
	methods: Array<{
		name: string;
		signature: string;
		line: number;
		endLine: number;
		docstring?: string;
		body?: string;
	}>;
}
