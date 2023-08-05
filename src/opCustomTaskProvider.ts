import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface OpCustomTaskDefinition extends vscode.TaskDefinition {
    commandLine: string;
}

export class OpCustomTaskProvider implements vscode.TaskProvider {
    static OpenplanetTaskType = 'Openplanet Remote Build Custom';
    private tasks: vscode.Task[] | undefined;

    constructor(private workspaceRoot: string) {
        const pattern = path.join(workspaceRoot, 'info.toml');
        const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        fileWatcher.onDidChange(() => this.tasks = undefined);
        fileWatcher.onDidCreate(() => this.tasks = undefined);
        fileWatcher.onDidDelete(() => this.tasks = undefined);
    }

    public async provideTasks(): Promise<vscode.Task[]> {
        if (this.tasks !== undefined) {
            return this.tasks;
        }
        this.tasks = [];

        if (fs.existsSync(path.join(this.workspaceRoot, 'info.toml'))) {
            this.tasks.push(this.getTask('./build.sh'));
        }

        return this.tasks;
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        const commandLine = _task.definition.commandLine;
        if (commandLine) {
            const definition: OpCustomTaskDefinition = <any>_task.definition;
            return this.getTask(commandLine, definition);
        }
        return undefined;
    }

    private getTask(commandLine: string, definition?: OpCustomTaskDefinition): vscode.Task {
        if (definition === undefined) {
            definition = {
                type: OpCustomTaskProvider.OpenplanetTaskType,
                commandLine,
            };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, 'Load from Custom Script',
            OpCustomTaskProvider.OpenplanetTaskType, new vscode.ShellExecution(commandLine),
            '$Openplanet Remote Build Problem Matcher: Angelscript Compiler');
    }
}