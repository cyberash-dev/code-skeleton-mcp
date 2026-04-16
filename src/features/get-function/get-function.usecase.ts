import { SymbolNotFoundError, UnsupportedLanguageError } from "../../domain/errors.js";
import { detectFromPath } from "../../domain/language.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { FunctionVariant, ParserPort } from "../../ports/parser.port.js";
import type { GetFunctionInput } from "./get-function.schema.js";

export interface GetFunctionResult {
	path: string;
	symbol: string;
	variants: FunctionVariant[];
}

export class GetFunctionUseCase {
	constructor(
		private readonly fs: FileSystemPort,
		private readonly parser: ParserPort,
	) {}

	async execute(input: GetFunctionInput): Promise<GetFunctionResult> {
		const lang = detectFromPath(input.path);
		if (!lang) {
			throw new UnsupportedLanguageError(input.path);
		}
		const source = await this.fs.readFile(input.path);
		const result = await this.parser.getSymbolBody(source, lang, input.symbol);
		if (!result) {
			throw new SymbolNotFoundError(input.symbol, input.path);
		}
		return { path: input.path, symbol: input.symbol, variants: result.variants };
	}
}
