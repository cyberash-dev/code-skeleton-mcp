import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Language, type Node, Parser, Query, type Tree } from "web-tree-sitter";
import { ParseError } from "../../domain/errors.js";
import type { Language as DomainLanguage } from "../../domain/language.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/adapters/parser/runtime.ts  → ../../..  = project root
// dist/adapters/parser/runtime.js → ../../..  = project root
const ROOT = resolve(here, "..", "..", "..");

const WASM_FILES: Record<DomainLanguage, string> = {
	python: "tree-sitter-python.wasm",
	go: "tree-sitter-go.wasm",
	javascript: "tree-sitter-javascript.wasm",
	typescript: "tree-sitter-typescript.wasm",
	tsx: "tree-sitter-tsx.wasm",
};

const QUERY_FILES: Record<DomainLanguage, string[]> = {
	python: ["python.scm"],
	go: ["go.scm", "go.local.scm"],
	javascript: ["javascript.scm", "javascript.local.scm"],
	// TypeScript tags.scm extends JavaScript's — concat both.
	typescript: [
		"javascript.scm",
		"javascript.local.scm",
		"typescript.scm",
		"typescript.local.scm",
	],
	tsx: ["javascript.scm", "javascript.local.scm", "typescript.scm", "typescript.local.scm"],
};

let initPromise: Promise<void> | null = null;
const languageCache = new Map<DomainLanguage, Language>();
const queryCache = new Map<DomainLanguage, Query>();

export async function initRuntime(): Promise<void> {
	if (!initPromise) {
		initPromise = Parser.init();
	}
	return initPromise;
}

export async function getLanguage(lang: DomainLanguage): Promise<Language> {
	await initRuntime();
	const cached = languageCache.get(lang);
	if (cached) {
		return cached;
	}
	const wasmPath = resolve(ROOT, "wasm", WASM_FILES[lang]);
	const loaded = await Language.load(wasmPath);
	languageCache.set(lang, loaded);
	return loaded;
}

export async function getQuery(lang: DomainLanguage): Promise<Query> {
	const cached = queryCache.get(lang);
	if (cached) {
		return cached;
	}
	const language = await getLanguage(lang);
	const parts: string[] = [];
	for (const file of QUERY_FILES[lang]) {
		parts.push(await readFile(resolve(ROOT, "queries", file), "utf8"));
	}
	const query = new Query(language, parts.join("\n"));
	queryCache.set(lang, query);
	return query;
}

export async function parseSource(source: string, lang: DomainLanguage): Promise<Tree> {
	const language = await getLanguage(lang);
	const parser = new Parser();
	parser.setLanguage(language);
	const tree = parser.parse(source);
	if (!tree) {
		throw new ParseError(`Failed to parse ${lang} source`);
	}
	return tree;
}

export type { Tree, Node };
