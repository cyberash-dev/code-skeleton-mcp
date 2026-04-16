export class DomainError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
	}
}

export class FileNotFoundError extends DomainError {
	constructor(path: string) {
		super("FILE_NOT_FOUND", `File not found: ${path}`);
	}
}

export class UnsupportedLanguageError extends DomainError {
	constructor(path: string) {
		super("UNSUPPORTED_LANGUAGE", `Unsupported file type: ${path}`);
	}
}

export class SymbolNotFoundError extends DomainError {
	constructor(symbol: string, path: string) {
		super("SYMBOL_NOT_FOUND", `Symbol "${symbol}" not found in ${path}`);
	}
}

export class ParseError extends DomainError {
	constructor(message: string) {
		super("PARSE_ERROR", message);
	}
}
