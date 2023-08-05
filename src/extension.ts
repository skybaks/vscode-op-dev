import * as vscode from 'vscode';
import { OpBuildTaskProvider } from './opBuildTaskProvider';

let opBuildTaskProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext): void {
    const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (!workspaceRoot) {
        return;
    }

    opBuildTaskProvider = vscode.tasks.registerTaskProvider(OpBuildTaskProvider.OpenplanetTaskType, new OpBuildTaskProvider(workspaceRoot));
}

export function deactivate(): void {
    if (opBuildTaskProvider) {
        opBuildTaskProvider.dispose();
    }
}