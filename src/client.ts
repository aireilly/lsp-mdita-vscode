import * as path from 'path';
import * as vscode from 'vscode';
import {
    CodeLens,
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

import { extId, extName, readConfig } from './config';
import { ensureDownloadedServer } from './download';
import {
    SearchEnv,
    defaultSearchEnv,
    findServerBinary,
    searchDirs,
    splitCommand,
} from './locate';

export type ServerSource = 'customCommand' | 'path' | 'download';

export interface ResolvedServer {
    command: string;
    args: string[];
    cwd?: string;
    source: ServerSource;
}

/**
 * Finds a server to run. The custom command wins outright: when it is set and
 * cannot be resolved, resolution fails rather than falling through to the
 * search and the download.
 */
export async function resolveServer(
    context: vscode.ExtensionContext,
    env: SearchEnv = defaultSearchEnv()
): Promise<ResolvedServer> {
    const config = readConfig();

    if (config.customCommand) {
        const split = splitCommand(config.customCommand);
        if (!split) {
            throw new Error('mdita-lsp.customCommand is set but empty.');
        }
        if (!isRunnable(split.command, env)) {
            throw new Error(
                `mdita-lsp.customCommand names "${split.command}", which is not an executable file ` +
                `and was not found on PATH.`
            );
        }
        return {
            command: split.command,
            args: split.args,
            cwd: config.customCommandDir,
            source: 'customCommand',
        };
    }

    const onDisk = findServerBinary(env);
    if (onDisk) {
        return { command: onDisk, args: [], source: 'path' };
    }

    const downloaded = await ensureDownloadedServer(context, env.platform, env.arch);
    return { command: downloaded, args: [], source: 'download' };
}

export function buildClient(server: ResolvedServer, outputChannel: vscode.OutputChannel): LanguageClient {
    const serverOptions: ServerOptions = {
        command: server.command,
        args: server.args,
        options: server.cwd ? { cwd: server.cwd } : {},
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'markdown' },
            { scheme: 'file', language: 'mditamap' },
        ],
        outputChannel,
        middleware: {
            // The server writes the file and stops there, so open the result
            // once it has done its work. LSP-mdita intercepts the same command.
            executeCommand: async (command, args, next) => {
                const result = await next(command, args);
                if (command === `${extId}.createFile` && typeof args?.[0] === 'string') {
                    await openDocument(args[0]);
                }
                return result;
            },
            provideCodeLenses: async (document, token, next) => {
                const lenses = await next(document, token);
                if (!lenses || !readConfig().hideZeroReferenceLenses) {
                    return lenses;
                }
                return lenses.filter((lens: CodeLens) => !(lens.command?.title ?? '').startsWith('0 '));
            },
        },
    };

    return new LanguageClient(extId, extName, serverOptions, clientOptions);
}

async function openDocument(uri: string): Promise<void> {
    try {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
        await vscode.window.showTextDocument(document);
    } catch (error) {
        void vscode.window.showErrorMessage(`${extName}: could not open ${uri}: ${errorText(error)}`);
    }
}

function isRunnable(command: string, env: SearchEnv): boolean {
    if (command.includes(path.sep) || command.includes('/')) {
        return env.isExecutable(command);
    }

    const withExtension = env.platform === 'win32' && !command.toLowerCase().endsWith('.exe')
        ? `${command}.exe`
        : command;

    return searchDirs(env).some((dir) => env.isExecutable(path.join(dir, withExtension)));
}

export function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
