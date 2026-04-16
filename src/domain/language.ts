import path from "node:path";

export type Language = "python" | "go" | "typescript" | "tsx" | "javascript";

const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
	".py": "python",
	".pyi": "python",
	".go": "go",
	".ts": "typescript",
	".tsx": "tsx",
	".mts": "typescript",
	".cts": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".mjs": "javascript",
	".cjs": "javascript",
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_LANGUAGE);

export function detectFromPath(filePath: string): Language | null {
	const ext = path.extname(filePath).toLowerCase();
	return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

export function isSupported(filePath: string): boolean {
	return detectFromPath(filePath) !== null;
}
