import * as vscode from 'vscode';
import { LanguageClient, State } from 'vscode-languageclient/node';

import { buildClient, errorText, resolveServer } from './client';
import { ExtensionHost, registerCommands, reloadConfiguration } from './commands';
import { affectsServerLaunch, extName } from './config';
import { queryServerVersion, releasesPageUrl } from './locate';
import { ServerStatus } from './status';

let client: LanguageClient | null = null;
let status: ServerStatus | null = null;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel(extName);
    context.subscriptions.push(outputChannel);

    status = new ServerStatus();
    context.subscriptions.push({ dispose: () => status?.dispose() });

    const host: ExtensionHost = {
        currentClient: () => client,
        restart: () => restart(context),
        outputChannel,
    };

    registerCommands(context, host);
    watchServerConfig(context, host);

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (affectsServerLaunch(event)) {
                await restart(context);
            }
        })
    );

    await start(context);
}

export async function deactivate(): Promise<void> {
    await stopClient();
}

/**
 * Edits to `.mdita-lsp.yaml` reach the server through a configuration
 * notification, which makes it re-read the file. The user config at
 * `~/.config/mdita-lsp/config.yaml` lives outside the workspace and is covered
 * by the Reload Configuration command instead.
 */
function watchServerConfig(context: vscode.ExtensionContext, host: ExtensionHost): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.mdita-lsp.yaml');
    const notify = () => void reloadConfiguration(host);

    context.subscriptions.push(
        watcher,
        watcher.onDidCreate(notify),
        watcher.onDidChange(notify),
        watcher.onDidDelete(notify)
    );
}

async function start(context: vscode.ExtensionContext): Promise<void> {
    status?.setStarting();

    let server;
    try {
        server = await resolveServer(context);
    } catch (error) {
        await reportStartupFailure(error);
        return;
    }

    outputChannel.appendLine(`Starting mdita-lsp: ${server.command} (resolved from ${server.source})`);
    client = buildClient(server, outputChannel);

    client.onDidChangeState((event) => {
        if (event.newState === State.Running) {
            status?.setRunning();
        } else if (event.newState === State.Stopped) {
            status?.setStopped();
        }
    });

    try {
        await client.start();
    } catch (error) {
        status?.setStopped(errorText(error));
        void vscode.window.showErrorMessage(
            `${extName}: the language server failed to start. ${errorText(error)}`
        );
        return;
    }

    const version = await queryServerVersion(server.command, server.args);
    status?.setServer(server.command, version);
}

async function restart(context: vscode.ExtensionContext): Promise<void> {
    await stopClient();
    await start(context);
}

async function stopClient(): Promise<void> {
    const current = client;
    client = null;
    if (!current) {
        return;
    }

    try {
        await current.stop();
    } catch (error) {
        outputChannel?.appendLine(`Error stopping the language server: ${errorText(error)}`);
    }

    try {
        current.dispose();
    } catch {
        // Already disposed by stop().
    }
}

async function reportStartupFailure(error: unknown): Promise<void> {
    status?.setStopped(errorText(error));
    outputChannel.appendLine(`Could not start mdita-lsp: ${errorText(error)}`);

    const openReleases = 'Open releases';
    const choice = await vscode.window.showErrorMessage(`${extName}: ${errorText(error)}`, openReleases);
    if (choice === openReleases) {
        await vscode.env.openExternal(vscode.Uri.parse(releasesPageUrl));
    }
}
