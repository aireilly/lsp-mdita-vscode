import * as vscode from 'vscode';

import { extId, extName } from './config';

type RunState = 'starting' | 'running' | 'stopped';

/**
 * Status bar entry for the language server. The server sends no status
 * notification and exposes no document count, so the entry tracks the language
 * client's own state.
 */
export class ServerStatus {
    private readonly item: vscode.StatusBarItem;
    private state: RunState = 'starting';
    private detail = '';

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
        this.item.command = `${extId}.showOutputChannel`;
        this.render();
        this.item.show();
    }

    setStarting(): void {
        this.state = 'starting';
        this.render();
    }

    setRunning(): void {
        this.state = 'running';
        this.render();
    }

    setStopped(reason?: string): void {
        this.state = 'stopped';
        if (reason) {
            this.detail = reason;
        }
        this.render();
    }

    /** Records the binary behind the client, shown in the tooltip. */
    setServer(command: string, version: string | null): void {
        this.detail = version ? `${version}\n${command}` : command;
        this.render();
    }

    dispose(): void {
        this.item.dispose();
    }

    private render(): void {
        const label = {
            starting: '$(sync~spin) MDITA',
            running: '$(check) MDITA',
            stopped: '$(error) MDITA',
        }[this.state];

        const summary = {
            starting: `${extName}: starting`,
            running: `${extName}: running`,
            stopped: `${extName}: stopped`,
        }[this.state];

        this.item.text = label;
        this.item.tooltip = this.detail ? `${summary}\n${this.detail}` : summary;
        this.item.backgroundColor = this.state === 'stopped'
            ? new vscode.ThemeColor('statusBarItem.warningBackground')
            : undefined;
    }
}
