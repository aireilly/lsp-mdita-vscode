import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';

/**
 * The mdita-lsp release this extension is built against. Downloads are pinned
 * to it, and the downloaded binary is cached under a directory of this name.
 */
export const serverRelease = 'v1.0.2';

export const releaseBaseUrl = 'https://github.com/aireilly/mdita-lsp/releases/download';
export const releasesPageUrl = 'https://github.com/aireilly/mdita-lsp/releases';

/**
 * Everything binary resolution needs from the outside world. Injected so the
 * search order can be tested without touching the real filesystem.
 */
export interface SearchEnv {
    platform: NodeJS.Platform;
    arch: string;
    pathVar: string;
    homeDir: string;
    isExecutable: (candidate: string) => boolean;
}

export function defaultSearchEnv(): SearchEnv {
    return {
        platform: os.platform(),
        arch: os.arch(),
        pathVar: process.env.PATH ?? '',
        homeDir: os.homedir(),
        isExecutable: isExecutableFile,
    };
}

export function isExecutableFile(candidate: string): boolean {
    try {
        if (!fs.statSync(candidate).isFile()) {
            return false;
        }
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

/** Name of the server binary on disk. */
export function serverBinName(platform: NodeJS.Platform): string {
    return platform === 'win32' ? 'mdita-lsp.exe' : 'mdita-lsp';
}

/**
 * Name of the GitHub release asset for a platform. The server's release
 * workflow builds one asset per GOOS/GOARCH pair as
 * `mdita-lsp-<goos>-<goarch>`, with `.exe` appended on Windows.
 */
export function releaseAssetName(platform: NodeJS.Platform, arch: string): string {
    const goos = platform === 'win32' ? 'windows' : platform;
    const goarch = arch === 'x64' ? 'amd64' : arch;

    const supported = [
        'linux-amd64',
        'linux-arm64',
        'darwin-amd64',
        'darwin-arm64',
        'windows-amd64',
    ];

    const pair = `${goos}-${goarch}`;
    if (!supported.includes(pair)) {
        throw new Error(
            `mdita-lsp publishes no binary for ${platform}/${arch}. ` +
            `Build it from source and put it on your PATH, or set mdita-lsp.customCommand.`
        );
    }

    return goos === 'windows' ? `mdita-lsp-${pair}.exe` : `mdita-lsp-${pair}`;
}

export function releaseDownloadUrl(platform: NodeJS.Platform, arch: string): string {
    return `${releaseBaseUrl}/${serverRelease}/${releaseAssetName(platform, arch)}`;
}

/**
 * Directories searched for the binary, in order: everything on PATH, then the
 * locations `make install` and `go install` use. LSP-mdita searches the same
 * extra directories.
 */
export function searchDirs(env: SearchEnv): string[] {
    const delimiter = env.platform === 'win32' ? ';' : ':';
    const fromPath = env.pathVar.split(delimiter).filter((dir) => dir.length > 0);

    return [
        ...fromPath,
        path.join(env.homeDir, '.local', 'bin'),
        path.join(env.homeDir, 'go', 'bin'),
        '/usr/local/bin',
    ];
}

/** First executable copy of the server on disk, or null when there is none. */
export function findServerBinary(env: SearchEnv): string | null {
    const binName = serverBinName(env.platform);
    for (const dir of searchDirs(env)) {
        const candidate = path.join(dir, binName);
        if (env.isExecutable(candidate)) {
            return candidate;
        }
    }
    return null;
}

export interface SplitCommand {
    command: string;
    args: string[];
}

/** Splits a user-supplied command string into a command and its arguments. */
export function splitCommand(value: string): SplitCommand | null {
    const parts = value.trim().split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) {
        return null;
    }
    const [command, ...args] = parts;
    return { command, args };
}

/**
 * Version string reported by the binary, for the status bar tooltip. Resolves
 * to null rather than rejecting, since a missing version is cosmetic.
 */
export function queryServerVersion(command: string, args: string[] = []): Promise<string | null> {
    return new Promise((resolve) => {
        const child = execFile(
            command,
            [...args, '--version'],
            { timeout: 5000 },
            (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }
                const line = stdout.trim().split('\n')[0]?.trim();
                resolve(line && line.length > 0 ? line : null);
            }
        );
        child.on('error', () => resolve(null));
    });
}
