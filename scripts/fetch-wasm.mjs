#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
// Refresh wasm/ and queries/ from upstream tree-sitter grammar releases.
// Run manually: `npm run fetch-wasm`. Output is committed.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const wasmDir = resolve(root, "wasm");
const queriesDir = resolve(root, "queries");
const tmpDir = resolve(root, ".tmp-wasm");

const GRAMMARS = [
	{
		pkg: "tree-sitter-python",
		version: "0.25.0",
		wasms: ["tree-sitter-python.wasm"],
		tags: "https://raw.githubusercontent.com/tree-sitter/tree-sitter-python/master/queries/tags.scm",
		queryName: "python.scm",
	},
	{
		pkg: "tree-sitter-go",
		version: "0.25.0",
		wasms: ["tree-sitter-go.wasm"],
		tags: "https://raw.githubusercontent.com/tree-sitter/tree-sitter-go/master/queries/tags.scm",
		queryName: "go.scm",
	},
	{
		pkg: "tree-sitter-javascript",
		version: "0.25.0",
		wasms: ["tree-sitter-javascript.wasm"],
		tags: "https://raw.githubusercontent.com/tree-sitter/tree-sitter-javascript/master/queries/tags.scm",
		queryName: "javascript.scm",
	},
	{
		pkg: "tree-sitter-typescript",
		version: "0.23.2",
		wasms: ["tree-sitter-typescript.wasm", "tree-sitter-tsx.wasm"],
		tags: "https://raw.githubusercontent.com/tree-sitter/tree-sitter-typescript/master/queries/tags.scm",
		queryName: "typescript.scm",
	},
];

async function run() {
	await mkdir(wasmDir, { recursive: true });
	await mkdir(queriesDir, { recursive: true });
	await rm(tmpDir, { recursive: true, force: true });
	await mkdir(tmpDir, { recursive: true });

	for (const g of GRAMMARS) {
		const tarballUrl = `https://registry.npmjs.org/${g.pkg}/-/${g.pkg}-${g.version}.tgz`;
		const tarballPath = resolve(tmpDir, `${g.pkg}-${g.version}.tgz`);
		const extractDir = resolve(tmpDir, g.pkg);
		await mkdir(extractDir, { recursive: true });

		console.error(`fetch ${tarballUrl}`);
		const res = await fetch(tarballUrl);
		if (!res.ok) {
			throw new Error(`Failed to fetch ${tarballUrl}: ${res.status}`);
		}
		await pipeline(res.body, createWriteStream(tarballPath));

		await execCmd("tar", ["-xzf", tarballPath, "-C", extractDir]);

		for (const wasm of g.wasms) {
			const src = resolve(extractDir, "package", wasm);
			const dst = resolve(wasmDir, wasm);
			await pipeline(createReadStream(src), createWriteStream(dst));
			console.error(`wrote ${dst}`);
		}

		console.error(`fetch ${g.tags}`);
		const tagsRes = await fetch(g.tags);
		if (!tagsRes.ok) {
			throw new Error(`Failed to fetch ${g.tags}: ${tagsRes.status}`);
		}
		const tagsText = await tagsRes.text();
		const queryPath = resolve(queriesDir, g.queryName);
		await writeFile(queryPath, tagsText);
		console.error(`wrote ${queryPath}`);
	}

	await rm(tmpDir, { recursive: true, force: true });
	console.error("done");
}

function execCmd(cmd, args) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(cmd, args, { stdio: "inherit" });
		child.once("error", rejectPromise);
		child.once("exit", (code) => {
			if (code === 0) {
				resolvePromise();
			} else {
				rejectPromise(new Error(`${cmd} exited with ${code}`));
			}
		});
	});
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
