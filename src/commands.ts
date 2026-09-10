import * as path from 'path';
import * as vscode from 'vscode';
import {
    DidChangeConfigurationNotification,
    ExecuteCommandRequest,
    LanguageClient,
} from 'vscode-languageclient/node';

import { errorText } from './client';
import { extId, extName } from './config';
import { isMapDocument } from './mapfile';

/** What the commands need from the extension that owns the language client. */
export interface ExtensionHost {
    currentClient(): LanguageClient | null;
    restart(): Promise<void>;
    outputChannel: vscode.OutputChannel;
}

export type DitaOtFormat = 'xhtml' | 'dita';

export function registerCommands(context: vscode.ExtensionContext, host: ExtensionHost): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(`${extId}.restartServer`, () => host.restart()),

        vscode.commands.registerCommand(`${extId}.showOutputChannel`, () => {
            host.outputChannel.show(true);
        }),

        vscode.commands.registerCommand(`${extId}.reloadConfiguration`, async () => {
            const reloaded = await reloadConfiguration(host);
            if (reloaded) {
                void vscode.window.showInformationMessage(`${extName}: configuration reloaded.`);
            }
        }),

        vscode.commands.registerCommand(`${extId}.build.xhtml`, () => build(host, 'xhtml')),
        vscode.commands.registerCommand(`${extId}.build.dita`, () => build(host, 'dita'))
    );
}

/**
 * Asks the server to re-read `.mdita-lsp.yaml`. The notification carries no
 * payload the server inspects; it reloads config from disk and refreshes
 * diagnostics on receipt.
 */
export async function reloadConfiguration(host: ExtensionHost): Promise<boolean> {
    const client = runningClient(host);
    if (!client) {
        return false;
    }

    try {
        await client.sendNotification(DidChangeConfigurationNotification.type, { settings: {} });
        return true;
    } catch (error) {
        void vscode.window.showErrorMessage(`${extName}: configuration reload failed: ${errorText(error)}`);
        return false;
    }
}

async function build(host: ExtensionHost, format: DitaOtFormat): Promise<void> {
    const client = runningClient(host);
    if (!client) {
        void vscode.window.showErrorMessage(`${extName}: the language server is not running.`);
        return;
    }

    const mapUri = await pickMapUri();
    if (!mapUri) {
        return;
    }

    try {
        await client.sendRequest(ExecuteCommandRequest.type, {
            command: `${extId}.ditaOtBuild`,
            arguments: [mapUri.toString(), format],
        });
    } catch (error) {
        void vscode.window.showErrorMessage(`${extName}: DITA-OT build failed to start: ${errorText(error)}`);
    }
}

/**
 * The map to build: the active editor when it holds one, and otherwise a pick
 * over the `.mditamap` files in the workspace.
 */
async function pickMapUri(): Promise<vscode.Uri | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.uri.scheme === 'file'
        && isMapDocument(editor.document.uri.fsPath, editor.document.getText())) {
        return editor.document.uri;
    }

    const candidates = await vscode.workspace.findFiles('**/*.mditamap', '**/node_modules/**', 200);
    if (candidates.length === 0) {
        void vscode.window.showWarningMessage(
            `${extName}: no map found. Open a .mditamap file, or a Markdown file declaring the DITA map schema.`
        );
        return undefined;
    }
    if (candidates.length === 1) {
        return candidates[0];
    }

    const picked = await vscode.window.showQuickPick(
        candidates.map((uri) => ({
            label: path.basename(uri.fsPath),
            description: vscode.workspace.asRelativePath(uri),
            uri,
        })),
        { placeHolder: 'Select the map to build' }
    );

    return picked?.uri;
}

function runningClient(host: ExtensionHost): LanguageClient | null {
    const client = host.currentClient();
    return client?.isRunning() ? client : null;
}
