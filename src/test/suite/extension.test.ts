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

function fixture(name: string): vscode.Uri {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'the fixture workspace is not open');
    return vscode.Uri.file(path.join(folder.uri.fsPath, name));
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

    it('serves diagnostics from the language server', async function () {
        this.timeout(60000);

        const uri = fixture('broken.md');
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Nothing built into VS Code produces diagnostics for Markdown, so a
        // diagnostic carrying this source can only have come from mdita-lsp.
        const diagnostics = await eventually('diagnostics from mdita-lsp', async () => {
            const found = vscode.languages
                .getDiagnostics(uri)
                .filter((d) => d.source === 'mdita-lsp');
            return found.length > 0 ? found : undefined;
        });

        assert.ok(
            diagnostics.some((d) => d.message.includes('does-not-exist.md')),
            `expected a broken link diagnostic, got ${diagnostics.map((d) => d.message).join(', ')}`
        );
    });

    it('serves document symbols from the language server', async function () {
        this.timeout(60000);

        const uri = fixture('intro.md');
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // VS Code merges every registered symbol provider, and its built-in
        // Markdown outline also yields a heading called Introduction. Symbol
        // kinds are what tell them apart: mdita-lsp reports a topic title as
        // Class and a section as Struct, so asserting on the kind fails when
        // our provider throws and only the built-in answers.
        const symbols = await eventually('document symbols from mdita-lsp', async () => {
            const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            const title = result?.find(
                (s) => s.name.includes('Introduction') && s.kind === vscode.SymbolKind.Class
            );
            return title ? result : undefined;
        });

        // Select by kind, not by name. The built-in outline contributes the
        // same heading names with SymbolKind.String, and picking the first
        // name match reads that one instead of ours.
        const title = symbols.find(
            (s) => s.name.includes('Introduction') && s.kind === vscode.SymbolKind.Class
        );
        assert.ok(title, 'no Introduction symbol from mdita-lsp');

        const section = title.children?.find((child) => child.name.includes('Setup'));
        assert.ok(section, `no Setup child, got ${title.children?.map((c) => c.name).join(', ')}`);
        assert.strictEqual(section.kind, vscode.SymbolKind.Struct);
    });

    it('serves workspace symbols from the language server', async function () {
        this.timeout(60000);

        // A workspace symbol needs a location, which is what the server used
        // to omit entirely by answering with a DocumentSymbol shape.
        const symbols = await eventually('workspace symbols', async () => {
            const result = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                'Introduction'
            );
            return result && result.length > 0 ? result : undefined;
        });

        const match = symbols.find((s) => s.name.includes('Introduction'));
        assert.ok(match, 'no Introduction workspace symbol');
        assert.ok(match.location, 'workspace symbol carries no location');
        assert.ok(
            match.location.uri.fsPath.endsWith('intro.md'),
            `location points at ${match.location.uri.fsPath}`
        );
    });
});
