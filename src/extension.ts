import * as vscode from 'vscode';
import { OpBuildTaskProvider } from './opBuildTaskProvider';
import { OpCustomTaskProvider } from './opCustomTaskProvider';

let opBuildTaskProvider: vscode.Disposable | undefined;
let opCustomTaskProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext): void {
    const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (!workspaceRoot) {
        return;
    }

    opBuildTaskProvider = vscode.tasks.registerTaskProvider(OpBuildTaskProvider.OpenplanetTaskType, new OpBuildTaskProvider(workspaceRoot));
    opCustomTaskProvider = vscode.tasks.registerTaskProvider(OpCustomTaskProvider.OpenplanetTaskType, new OpCustomTaskProvider(workspaceRoot));
}

export function deactivate(): void {
    if (opBuildTaskProvider) {
        opBuildTaskProvider.dispose();
    }
    if (opCustomTaskProvider) {
        opCustomTaskProvider.dispose();
    }
}