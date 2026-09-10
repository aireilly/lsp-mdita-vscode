import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');
        const workspacePath = path.resolve(extensionDevelopmentPath, 'testdata/workspace');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            // Opening the fixture workspace exercises the real activation
            // event, since it holds a .mdita-lsp.yaml file.
            launchArgs: [workspacePath, '--disable-extensions'],
        });
    } catch (error) {
        console.error('Failed to run integration tests:', error);
        process.exit(1);
    }
}

void main();
