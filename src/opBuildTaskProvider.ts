import * as vscode from 'vscode';
import * as net from 'net';

interface OpBuildTaskDefinition extends vscode.TaskDefinition { }

export class OpBuildTaskProvider implements vscode.TaskProvider {
    static CustomBuildScriptType = 'op-build';
    private tasks: vscode.Task[] | undefined;

    constructor(private workspaceRoot: string) { }

    public async provideTasks(): Promise<vscode.Task[]> {
        if (this.tasks !== undefined) {
            return this.tasks;
        }

        this.tasks = [];
        this.tasks!.push(this.getTask());
        return this.tasks;
    }

    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        return task;
    }

    private getTask(definition?: OpBuildTaskDefinition): vscode.Task {
        if (definition === undefined) {
            definition = {
                type: OpBuildTaskProvider.CustomBuildScriptType
            };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, "",
            OpBuildTaskProvider.CustomBuildScriptType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                return new OpBuildTaskTerminal(this.workspaceRoot)
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
        this.doBuild();
    }

    close(): void { }

    private async doBuild(): Promise<void> {
        return new Promise<void>((resolve) => {
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
                this.writeEmitter.fire('Got some data\r\n');
                this.receiveOpenplanet(data);
                this.closeEmitter.fire(0);
                resolve();
            });
        });
    }

    private receiveOpenplanet(data: Buffer): void {
        var message = JSON.parse(data.slice(4).toString());
        this.writeEmitter.fire('\tdata : ' + message.data + '\r\n');
        this.writeEmitter.fire('\terror: ' + message.error + '\r\n');
    }
}