import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { FileNotFoundError } from "../../domain/errors.js";
import type { FileStat, FileSystemPort } from "../../ports/file-system.port.js";

export class NodeFsAdapter implements FileSystemPort {
	async readFile(filePath: string): Promise<string> {
		try {
			return await fs.readFile(filePath, "utf8");
		} catch (err: unknown) {
			if (isNodeError(err) && err.code === "ENOENT") {
				throw new FileNotFoundError(filePath);
			}
			throw err;
		}
	}

	async stat(filePath: string): Promise<FileStat> {
		try {
			const s = await fs.stat(filePath);
			return {
				mtimeMs: s.mtimeMs,
				size: s.size,
				isDirectory: s.isDirectory(),
				isFile: s.isFile(),
			};
		} catch (err: unknown) {
			if (isNodeError(err) && err.code === "ENOENT") {
				throw new FileNotFoundError(filePath);
			}
			throw err;
		}
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	async listFiles(dir: string, opts: { recursive?: boolean } = {}): Promise<string[]> {
		const result: string[] = [];
		await walk(dir, opts.recursive ?? false, result);
		return result;
	}
}

async function walk(dir: string, recursive: boolean, out: string[]): Promise<void> {
	const entries = await readDirEntries(dir);
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) {
			if (recursive) {
				await walk(full, recursive, out);
			}
		} else if (e.isFile()) {
			out.push(full);
		}
	}
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
	return err instanceof Error && "code" in err;
}

async function readDirEntries(dir: string): Promise<Dirent[]> {
	try {
		return await fs.readdir(dir, { withFileTypes: true });
	} catch (err: unknown) {
		if (isNodeError(err) && err.code === "ENOENT") {
			throw new FileNotFoundError(dir);
		}
		throw err;
	}
}
