import { UnsupportedLanguageError } from "../../domain/errors.js";
import { detectFromPath, isSupported, SUPPORTED_EXTENSIONS } from "../../domain/language.js";
import type { Outline } from "../../domain/symbol.js";
import type { CachePort } from "../../ports/cache.port.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { ParserPort } from "../../ports/parser.port.js";
import type { GetOutlineInput } from "./get-outline.schema.js";

export class GetOutlineUseCase {
	constructor(
		private readonly fs: FileSystemPort,
		private readonly parser: ParserPort,
		private readonly cache: CachePort<Outline>,
	) {}

	async execute(input: GetOutlineInput): Promise<Outline | Outline[]> {
		const stat = await this.fs.stat(input.path);
		if (stat.isDirectory) {
			const files = await this.fs.listFiles(input.path, { recursive: input.recursive });
			const supported = files.filter((f) => isSupported(f));
			const out: Outline[] = [];
			for (const f of supported) {
				out.push(await this.outlineFile(f, input));
			}
			return out;
		}
		return this.outlineFile(input.path, input);
	}

	private async outlineFile(filePath: string, input: GetOutlineInput): Promise<Outline> {
		const lang = detectFromPath(filePath);
		if (!lang) {
			throw new UnsupportedLanguageError(filePath);
		}
		const fileStat = await this.fs.stat(filePath);
		const optsTag = `d=${input.max_depth}|doc=${input.include_docstrings ? 1 : 0}|priv=${input.include_private ? 1 : 0}`;
		const cacheKey = {
			path: `${filePath}::${optsTag}`,
			mtimeMs: fileStat.mtimeMs,
			size: fileStat.size,
		};
		const hit = this.cache.get(cacheKey);
		if (hit) {
			return hit;
		}
		const source = await this.fs.readFile(filePath);
		const { symbols, warnings } = await this.parser.parseOutline(source, lang, {
			includeDocstrings: input.include_docstrings,
			includePrivate: input.include_private,
			maxDepth: input.max_depth,
		});
		const outline: Outline = {
			path: filePath,
			language: lang,
			symbols,
		};
		if (warnings.length > 0) {
			outline.warnings = warnings;
		}
		this.cache.set(cacheKey, outline);
		return outline;
	}
}

export { SUPPORTED_EXTENSIONS };
