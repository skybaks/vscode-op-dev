import * as vscode from 'vscode';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';

interface OpBuildTaskDefinition extends vscode.TaskDefinition {
    pluginId: string;
    openplanetPort: number;
}

export class OpBuildTaskProvider implements vscode.TaskProvider {
    static OpenplanetTaskType = 'Openplanet RemoteBuild';
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

        let port: number | undefined = undefined;
        let pluginId: string = path.basename(this.workspaceRoot);
        const pluginsDir = path.dirname(this.workspaceRoot);
        if (path.basename(pluginsDir) === 'Plugins') {
            const opFolderName = path.basename(path.dirname(pluginsDir));
            if (opFolderName === 'OpenplanetNext') {
                port = 30000;
            } else if (opFolderName === 'Openplanet4') {
                port = 30001;
            } else if (opFolderName === 'OpenplanetTurbo') {
                port = 30002;
            }
        }

        if (port !== undefined) {
            this.tasks!.push(this.getTask(pluginId, port));
        }

        return this.tasks;
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        const pluginId = _task.definition.pluginId;
        const openplanetPort = _task.definition.openplanetPort;
        if (pluginId && openplanetPort) {
            const definition: OpBuildTaskDefinition = <any>_task.definition;
            return this.getTask(pluginId, openplanetPort, definition);
        }
        return undefined;
    }

    private getTask(pluginId: string, openplanetPort: number, definition?: OpBuildTaskDefinition): vscode.Task {
        if (definition === undefined) {
            definition = {
                type: OpBuildTaskProvider.OpenplanetTaskType,
                pluginId,
                openplanetPort,
            };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, "Load/Reload from User Folder",
            OpBuildTaskProvider.OpenplanetTaskType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                return new OpBuildTaskTerminal(this.workspaceRoot, pluginId, openplanetPort);
            }));
    }
}

class OpBuildTaskTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<number>();
    onDidClose?: vscode.Event<number> = this.closeEmitter.event;
    private client: net.Socket | undefined = new net.Socket();

    constructor(private workspaceRoot: string, private pluginId: string, private openplanetPort: number) { }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        const openplanetDir = path.dirname(path.dirname(this.workspaceRoot));
        const openplanetLogPath = path.join(openplanetDir, 'Openplanet.log');
        let logStartSize: number = -1;
        let logEndSize: number = -1;

        new Promise<void>((resolve, reject) => {
            fs.stat(openplanetLogPath, (error, stats) => {
                if (error) {
                    this.writeEmitter.fire('Error encountered getting information about log file\r\n');
                    reject();
                } else {
                    logStartSize = stats.size;
                    this.writeEmitter.fire('size: ' + logStartSize.toString() + '\r\n');
                    resolve();
                }
            });
        })
        .then(() => this.doBuild())
        .catch((e) => {
            this.writeEmitter.fire('Error encountered:\r\n');
            this.writeEmitter.fire(e.toString() + '\r\n');
            this.closeEmitter.fire(0);
        })
        .then(() => new Promise<void>((resolve, reject) => {
            fs.stat(openplanetLogPath, (error, stats) => {
                if (error) {
                    this.writeEmitter.fire('Error encountered getting info from log file (2nd time)\r\n');
                    reject();
                } else {
                    logEndSize = stats.size;
                    this.writeEmitter.fire('size: ' + logEndSize.toString() + '\r\n');
                    resolve();
                }
            });
        }))
        .then(() => new Promise<void>((resolve, reject) => {
            fs.open(openplanetLogPath, 'r', (error, fd) => {
                if (error) {
                    this.writeEmitter.fire('Error opening log file\r\n');
                    reject();
                } else {
                    let buf = Buffer.alloc(logEndSize - logStartSize);
                    fs.read(fd, buf, 0, logEndSize - logStartSize, logStartSize, (error, count, buffer) => {
                        const logString = buffer.toString('utf8');
                        const logLines = logString.split(/\r\n|\r|\n/);
                        logLines.forEach((line) => {
                            this.writeEmitter.fire(line + '\r\n');
                        });
                        resolve();
                    });
                }
            });
        }))
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

            this.client.connect(this.openplanetPort, 'localhost', () => {
                this.writeEmitter.fire('Connected to socket\r\n');
                this.client?.write(JSON.stringify({
                    route: 'load_plugin',
                    data: {
                        id: this.pluginId,
                        source: 'user',
                        type: 'folder'
                    }
                }));
            });
        });
    }
}