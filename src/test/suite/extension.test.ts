import * as assert from 'assert';
import * as vscode from 'vscode';

const extensionId = 'vscode-aidanreilly.mdita-lsp';

const contributedCommands = [
    'mdita-lsp.restartServer',
    'mdita-lsp.showOutputChannel',
    'mdita-lsp.reloadConfiguration',
    'mdita-lsp.build.xhtml',
    'mdita-lsp.build.dita',
];

describe('MDITA LSP extension', () => {
    it('is installed', () => {
        assert.ok(vscode.extensions.getExtension(extensionId), `${extensionId} is not installed`);
    });

    it('activates', async () => {
        const extension = vscode.extensions.getExtension(extensionId);
        assert.ok(extension);
        await extension.activate();
        assert.ok(extension.isActive);
    });

    it('registers its commands', async () => {
        const extension = vscode.extensions.getExtension(extensionId);
        await extension?.activate();

        const registered = await vscode.commands.getCommands(true);
        for (const command of contributedCommands) {
            assert.ok(registered.includes(command), `${command} is not registered`);
        }
    });

    it('registers the mditamap language', async () => {
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('mditamap'));
    });
});
