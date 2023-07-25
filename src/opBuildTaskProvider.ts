import * as vscode from 'vscode';
import * as net from 'net';
import * as path from 'path';

interface OpBuildTaskDefinition extends vscode.TaskDefinition { }

export class OpBuildTaskProvider implements vscode.TaskProvider {
    static OpenplanetTaskType = 'Openplanet';
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
        this.tasks!.push(this.getTask());
        return this.tasks;
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        return _task;
    }

    private getTask(definition?: OpBuildTaskDefinition): vscode.Task {
        if (definition === undefined) {
            definition = {
                type: OpBuildTaskProvider.OpenplanetTaskType
            };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, "Load or Reload Plugin",
            OpBuildTaskProvider.OpenplanetTaskType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                return new OpBuildTaskTerminal(this.workspaceRoot);
            }));
    }
}

class OpBuildTaskTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<number>();
    onDidClose?: vscode.Event<number> = this.closeEmitter.event;
    private client: net.Socket | undefined = new net.Socket();

    constructor(private workspaceRoot: string) { }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.doBuild()
            .catch((e) => {
                this.writeEmitter.fire('Error encountered:\r\n');
                this.writeEmitter.fire(e.toString() + '\r\n');
                this.closeEmitter.fire(0);
            })
            .then(() => {
                this.writeEmitter.fire('Promise was returned!\r\n');
                this.closeEmitter.fire(0);
            });
    }

    close(): void { }

    private async doBuild(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.writeEmitter.fire('Starting build\r\n');

            if (this.client === undefined) {
                this.client = new net.Socket();
            }

            this.client.connect(30000, 'localhost', () => {
                this.writeEmitter.fire('Connected to socket\r\n');
                this.client?.write(JSON.stringify({
                    route: 'load_plugin',
                    data: {
                        id: 'Testbed',
                        source: 'user',
                        type: 'folder'
                    }
                }));
            });

            this.client.on('data', (data) => {
                const message = JSON.parse(data.slice(4).toString());
                this.writeEmitter.fire('\tdata : ' + message.data + '\r\n');
                this.writeEmitter.fire('\terror: ' + message.error + '\r\n');
                resolve();
            });
            
            this.client.on('error', (error: Error) => {
                this.writeEmitter.fire('Encountered an error!\r\n');
                reject(error);
            });
        });
    }
}