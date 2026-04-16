// stderr-only logger — MCP stdio uses stdout for protocol, so all logs must go to stderr.

export const logger = {
	info: (message: string, meta?: unknown): void => write("INFO", message, meta),
	warn: (message: string, meta?: unknown): void => write("WARN", message, meta),
	error: (message: string, meta?: unknown): void => write("ERROR", message, meta),
	debug: (message: string, meta?: unknown): void => {
		if (process.env.CODE_SKELETON_DEBUG) {
			write("DEBUG", message, meta);
		}
	},
};

function write(level: string, message: string, meta?: unknown): void {
	const base = `[${new Date().toISOString()}] ${level} ${message}`;
	if (meta === undefined) {
		process.stderr.write(`${base}\n`);
		return;
	}
	process.stderr.write(`${base} ${safeStringify(meta)}\n`);
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
