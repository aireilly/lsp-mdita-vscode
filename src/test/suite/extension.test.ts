import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const extensionId = 'vscode-aidanreilly.mdita-lsp';

const contributedCommands = [
    'mdita-lsp.restartServer',
    'mdita-lsp.showOutputChannel',
    'mdita-lsp.reloadConfiguration',
    'mdita-lsp.build.xhtml',
    'mdita-lsp.build.dita',
];

/** Retries until the callback returns a value, or the budget runs out. */
async function eventually<T>(
    label: string,
    attempt: () => Promise<T | undefined>,
    budgetMs = 45000
): Promise<T> {
    const deadline = Date.now() + budgetMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const result = await attempt();
            if (result !== undefined) {
                return result;
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError}` : ''}`);
}

describe('MDITA LSP extension', () => {
    before(async function () {
        this.timeout(60000);
        const extension = vscode.extensions.getExtension(extensionId);
        assert.ok(extension, `${extensionId} is not installed`);
        await extension.activate();
    });

    it('activates in a workspace holding .mdita-lsp.yaml', () => {
        assert.strictEqual(vscode.extensions.getExtension(extensionId)?.isActive, true);
    });

    it('registers its commands', async () => {
        const registered = await vscode.commands.getCommands(true);
        for (const command of contributedCommands) {
            assert.ok(registered.includes(command), `${command} is not registered`);
        }
    });

    it('registers the commands the server executes', async () => {
        const registered = await eventually('the server commands', async () => {
            const all = await vscode.commands.getCommands(true);
            return all.includes('mdita-lsp.ditaOtBuild') ? all : undefined;
        });

        for (const command of ['mdita-lsp.createFile', 'mdita-lsp.addToMap', 'mdita-lsp.ditaOtBuild']) {
            assert.ok(registered.includes(command), `${command} is not registered`);
        }
    });

    it('registers the mditamap language', async () => {
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('mditamap'));
    });

    it('serves document symbols from the language server', async function () {
        this.timeout(60000);

        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'the fixture workspace is not open');

        const uri = vscode.Uri.file(path.join(folder.uri.fsPath, 'intro.md'));
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        const symbols = await eventually('document symbols', async () => {
            const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            return result && result.length > 0 ? result : undefined;
        });

        assert.ok(
            symbols.some((symbol) => symbol.name.includes('Introduction')),
            `expected an Introduction symbol, got ${symbols.map((s) => s.name).join(', ')}`
        );
    });
});
