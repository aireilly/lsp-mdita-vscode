import * as vscode from 'vscode';

export const extId = 'mdita-lsp';
export const extName = 'MDITA LSP';

export interface ExtensionConfig {
    customCommand: string | undefined;
    customCommandDir: string | undefined;
    hideZeroReferenceLenses: boolean;
}

export function readConfig(): ExtensionConfig {
    const conf = vscode.workspace.getConfiguration(extId);
    return {
        customCommand: nonEmpty(conf.get<string>('customCommand')),
        customCommandDir: nonEmpty(conf.get<string>('customCommandDir')),
        hideZeroReferenceLenses: conf.get<boolean>('codeLens.hideZeroReferences') ?? true,
    };
}

/**
 * True when a configuration change touches a setting that only takes effect on
 * a fresh server process.
 */
export function affectsServerLaunch(event: vscode.ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration(`${extId}.customCommand`)
        || event.affectsConfiguration(`${extId}.customCommandDir`);
}

function nonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
