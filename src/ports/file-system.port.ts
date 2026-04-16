export interface FileStat {
	mtimeMs: number;
	size: number;
	isDirectory: boolean;
	isFile: boolean;
}

export interface FileSystemPort {
	readFile(path: string): Promise<string>;
	stat(path: string): Promise<FileStat>;
	exists(path: string): Promise<boolean>;
	listFiles(dir: string, opts?: { recursive?: boolean }): Promise<string[]>;
}
