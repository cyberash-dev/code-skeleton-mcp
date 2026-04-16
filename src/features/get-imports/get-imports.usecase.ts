import path from "node:path";
import { UnsupportedLanguageError } from "../../domain/errors.js";
import { detectFromPath } from "../../domain/language.js";
import type { ImportRef } from "../../domain/symbol.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { ParserPort } from "../../ports/parser.port.js";
import type { GetImportsInput } from "./get-imports.schema.js";

export interface GetImportsResult {
	path: string;
	imports: ImportRef[];
}

export class GetImportsUseCase {
	constructor(
		private readonly fs: FileSystemPort,
		private readonly parser: ParserPort,
	) {}

	async execute(input: GetImportsInput): Promise<GetImportsResult> {
		const lang = detectFromPath(input.path);
		if (!lang) {
			throw new UnsupportedLanguageError(input.path);
		}
		const source = await this.fs.readFile(input.path);
		const imports = await this.parser.parseImports(source, lang);
		const dir = path.dirname(input.path);
		const enriched: ImportRef[] = [];
		for (const imp of imports) {
			const entry: ImportRef = { ...imp };
			if (imp.isRelative) {
				entry.resolvedPath = await this.resolveRelative(dir, imp.module);
			}
			enriched.push(entry);
		}
		return { path: input.path, imports: enriched };
	}

	private async resolveRelative(dir: string, modulePath: string): Promise<string | undefined> {
		const base = path.resolve(dir, modulePath);
		const candidates = [base];
		// Try common extensions if module has none.
		if (!path.extname(base)) {
			candidates.push(
				`${base}.ts`,
				`${base}.tsx`,
				`${base}.js`,
				`${base}.jsx`,
				`${base}.py`,
				`${base}.go`,
			);
			candidates.push(path.join(base, "index.ts"), path.join(base, "index.js"));
			candidates.push(path.join(base, "__init__.py"));
		}
		// Also: swap .js → .ts (TS files often import via .js that resolves to .ts).
		if (base.endsWith(".js")) {
			candidates.push(base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"));
		}
		for (const c of candidates) {
			if (await this.fs.exists(c)) {
				return c;
			}
		}
		return undefined;
	}
}
