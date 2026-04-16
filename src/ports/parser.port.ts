import type { Language } from "../domain/language.js";
import type { CodeSymbol, ImportRef } from "../domain/symbol.js";

export interface ParseOptions {
	includePrivate?: boolean;
	includeDocstrings?: boolean;
	maxDepth?: number;
}

export interface FunctionVariant {
	startLine: number;
	endLine: number;
	signature: string;
	docstring?: string;
	code: string;
}

export interface ClassMethodEntry {
	name: string;
	signature: string;
	line: number;
	endLine: number;
	docstring?: string;
	body?: string;
}

export interface ClassDumpResult {
	startLine: number;
	endLine: number;
	signature: string;
	docstring?: string;
	methods: ClassMethodEntry[];
}

export interface ParserPort {
	parseOutline(
		source: string,
		language: Language,
		opts: ParseOptions,
	): Promise<{ symbols: CodeSymbol[]; warnings: string[] }>;

	parseImports(source: string, language: Language): Promise<ImportRef[]>;

	getSymbolBody(
		source: string,
		language: Language,
		symbolPath: string,
	): Promise<{ variants: FunctionVariant[] } | null>;

	getClassDump(
		source: string,
		language: Language,
		className: string,
		includeBodies: boolean,
	): Promise<ClassDumpResult | null>;
}
