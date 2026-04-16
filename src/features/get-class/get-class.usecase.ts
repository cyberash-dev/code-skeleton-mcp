import { SymbolNotFoundError, UnsupportedLanguageError } from "../../domain/errors.js";
import { detectFromPath } from "../../domain/language.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { ClassDumpResult, ParserPort } from "../../ports/parser.port.js";
import type { GetClassInput } from "./get-class.schema.js";

export interface GetClassUseCaseResult extends ClassDumpResult {
	path: string;
	symbol: string;
}

export class GetClassUseCase {
	constructor(
		private readonly fs: FileSystemPort,
		private readonly parser: ParserPort,
	) {}

	async execute(input: GetClassInput): Promise<GetClassUseCaseResult> {
		const lang = detectFromPath(input.path);
		if (!lang) {
			throw new UnsupportedLanguageError(input.path);
		}
		const source = await this.fs.readFile(input.path);
		const result = await this.parser.getClassDump(
			source,
			lang,
			input.symbol,
			input.include_bodies,
		);
		if (!result) {
			throw new SymbolNotFoundError(input.symbol, input.path);
		}
		return { path: input.path, symbol: input.symbol, ...result };
	}
}
