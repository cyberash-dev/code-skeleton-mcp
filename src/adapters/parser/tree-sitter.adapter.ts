import type { Language } from "../../domain/language.js";
import type { CodeSymbol, ImportRef } from "../../domain/symbol.js";
import type {
	ClassDumpResult,
	ClassMethodEntry,
	FunctionVariant,
	ParseOptions,
	ParserPort,
} from "../../ports/parser.port.js";
import { extractImports } from "./imports.js";
import type { BuiltSymbol } from "./outline-builder.js";
import { buildOutline } from "./outline-builder.js";

export class TreeSitterParserAdapter implements ParserPort {
	async parseOutline(
		source: string,
		language: Language,
		opts: ParseOptions,
	): Promise<{ symbols: CodeSymbol[]; warnings: string[] }> {
		const result = await buildOutline(source, language, opts);
		return { symbols: result.symbols, warnings: result.warnings };
	}

	async parseImports(source: string, language: Language): Promise<ImportRef[]> {
		return extractImports(source, language);
	}

	async getSymbolBody(
		source: string,
		language: Language,
		symbolPath: string,
	): Promise<{ variants: FunctionVariant[] } | null> {
		const { built } = await buildOutline(source, language, {
			includeDocstrings: true,
			includePrivate: true,
		});
		const matches = findByPath(built, symbolPath);
		if (matches.length === 0) {
			return null;
		}
		const variants: FunctionVariant[] = matches.map((s) => {
			const v: FunctionVariant = {
				startLine: s.line,
				endLine: s.endLine,
				signature: s.signature ?? "",
				code: source.slice(s.node.startIndex, s.node.endIndex),
			};
			if (s.docstring) {
				v.docstring = s.docstring;
			}
			return v;
		});
		return { variants };
	}

	async getClassDump(
		source: string,
		language: Language,
		className: string,
		includeBodies: boolean,
	): Promise<ClassDumpResult | null> {
		const { built } = await buildOutline(source, language, {
			includeDocstrings: true,
			includePrivate: true,
		});
		const cls = findByPath(built, className)[0];
		if (!cls) {
			return null;
		}
		if (cls.kind !== "class" && cls.kind !== "interface" && cls.kind !== "struct") {
			return null;
		}
		const methods: ClassMethodEntry[] = (cls.children ?? [])
			.filter((c) => c.kind === "method" || c.kind === "constructor")
			.map((m) => {
				const entry: ClassMethodEntry = {
					name: m.name,
					signature: m.signature ?? "",
					line: m.line,
					endLine: m.endLine,
				};
				if (m.docstring) {
					entry.docstring = m.docstring;
				}
				if (includeBodies) {
					entry.body = source.slice(m.node.startIndex, m.node.endIndex);
				}
				return entry;
			});
		const result: ClassDumpResult = {
			startLine: cls.line,
			endLine: cls.endLine,
			signature: cls.signature ?? "",
			methods,
		};
		if (cls.docstring) {
			result.docstring = cls.docstring;
		}
		return result;
	}
}

function findByPath(built: BuiltSymbol[], path: string): BuiltSymbol[] {
	const parts = path.split(".");
	return collect(built, parts, 0);
}

function collect(list: BuiltSymbol[], parts: string[], idx: number): BuiltSymbol[] {
	if (idx >= parts.length) {
		return [];
	}
	const target = parts[idx];
	const matches = list.filter((s) => s.name === target);
	if (idx === parts.length - 1) {
		return matches;
	}
	const out: BuiltSymbol[] = [];
	for (const m of matches) {
		if (m.children) {
			out.push(...collect(m.children, parts, idx + 1));
		}
	}
	return out;
}
