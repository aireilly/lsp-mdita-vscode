import * as fs from 'fs';
import * as vscode from 'vscode';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';

import { releaseDownloadUrl, serverBinName, serverRelease } from './locate';

/**
 * Downloads the pinned release asset into `targetDir` and returns the path to
 * the executable. Node 18 and later provide `fetch`, so no HTTP dependency is
 * needed.
 */
export async function downloadRelease(
    targetDir: vscode.Uri,
    platform: NodeJS.Platform,
    arch: string,
    onProgress: (percent: number) => void
): Promise<string> {
    const url = releaseDownloadUrl(platform, arch);
    const targetFile = vscode.Uri.joinPath(targetDir, serverBinName(platform));
    const tempFile = vscode.Uri.joinPath(targetDir, `.download-${process.pid}-${Date.now()}`);

    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Download of ${url} failed with HTTP ${response.status} ${response.statusText}`);
    }

    const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
    const totalBytes = Number.isNaN(declaredLength) ? 0 : declaredLength;

    let receivedBytes = 0;
    let reportedPercent = 0;
    const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            receivedBytes += chunk.length;
            if (totalBytes > 0) {
                const percent = Math.floor((receivedBytes / totalBytes) * 100);
                if (percent > reportedPercent) {
                    reportedPercent = percent;
                    onProgress(percent);
                }
            }
            callback(null, chunk);
        },
    });

    try {
        await pipeline(
            Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
            counter,
            fs.createWriteStream(tempFile.fsPath)
        );
    } catch (error) {
        await vscode.workspace.fs.delete(tempFile).then(undefined, () => undefined);
        throw error;
    }

    await vscode.workspace.fs.rename(tempFile, targetFile, { overwrite: true });
    if (platform !== 'win32') {
        await fs.promises.chmod(targetFile.fsPath, 0o755);
    }

    return targetFile.fsPath;
}

/**
 * Path to a cached copy of the pinned release, downloading it first when it is
 * not already there.
 */
export async function ensureDownloadedServer(
    context: vscode.ExtensionContext,
    platform: NodeJS.Platform,
    arch: string
): Promise<string> {
    const targetDir = vscode.Uri.joinPath(context.globalStorageUri, serverRelease);
    const targetFile = vscode.Uri.joinPath(targetDir, serverBinName(platform));

    const cached = await exists(targetFile);
    if (cached) {
        return targetFile.fsPath;
    }

    await vscode.workspace.fs.createDirectory(targetDir);

    return vscode.window.withProgress(
        {
            cancellable: false,
            location: vscode.ProgressLocation.Notification,
            title: `Downloading mdita-lsp ${serverRelease}`,
        },
        async (progress) => {
            let lastPercent = 0;
            return downloadRelease(targetDir, platform, arch, (percent) => {
                progress.report({ message: `${percent}%`, increment: percent - lastPercent });
                lastPercent = percent;
            });
        }
    );
}

async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}
