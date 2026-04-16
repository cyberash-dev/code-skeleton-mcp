import type { Language } from "../../../domain/language.js";
import { goStrategy } from "./go.js";
import { pythonStrategy } from "./python.js";
import type { LanguageStrategy } from "./types.js";
import { typescriptStrategy } from "./typescript.js";

export function getStrategy(lang: Language): LanguageStrategy {
	switch (lang) {
		case "python":
			return pythonStrategy;
		case "go":
			return goStrategy;
		case "typescript":
			return typescriptStrategy;
		case "tsx":
			return typescriptStrategy;
		case "javascript":
			return typescriptStrategy;
		default: {
			const never: never = lang;
			throw new Error(`No strategy for language: ${never}`);
		}
	}
}
