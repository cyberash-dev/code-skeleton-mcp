import { InMemoryCacheAdapter } from "./adapters/cache/in-memory.adapter.js";
import { NodeFsAdapter } from "./adapters/file-system/node-fs.adapter.js";
import { TreeSitterParserAdapter } from "./adapters/parser/tree-sitter.adapter.js";
import { buildTargetRegistry, type TargetRegistry } from "./adapters/targets/registry.js";
import type { Outline } from "./domain/symbol.js";
import { GetClassUseCase } from "./features/get-class/get-class.usecase.js";
import { GetFunctionUseCase } from "./features/get-function/get-function.usecase.js";
import { GetImportsUseCase } from "./features/get-imports/get-imports.usecase.js";
import { GetOutlineUseCase } from "./features/get-outline/get-outline.usecase.js";
import { SetupUseCase } from "./features/setup/setup.usecase.js";

export interface Container {
	fs: NodeFsAdapter;
	parser: TreeSitterParserAdapter;
	outlineCache: InMemoryCacheAdapter<Outline>;
	targets: TargetRegistry;
	useCases: {
		getOutline: GetOutlineUseCase;
		getFunction: GetFunctionUseCase;
		getClass: GetClassUseCase;
		getImports: GetImportsUseCase;
		setup: SetupUseCase;
	};
}

export function buildContainer(): Container {
	const fs = new NodeFsAdapter();
	const parser = new TreeSitterParserAdapter();
	const outlineCache = new InMemoryCacheAdapter<Outline>();
	const targets = buildTargetRegistry();
	return {
		fs,
		parser,
		outlineCache,
		targets,
		useCases: {
			getOutline: new GetOutlineUseCase(fs, parser, outlineCache),
			getFunction: new GetFunctionUseCase(fs, parser),
			getClass: new GetClassUseCase(fs, parser),
			getImports: new GetImportsUseCase(fs, parser),
			setup: new SetupUseCase(targets),
		},
	};
}
