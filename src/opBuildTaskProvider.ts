import * as vscode from 'vscode';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';

interface OpBuildTaskDefinition extends vscode.TaskDefinition {
    pluginId: string;
    openplanetPort: number;
}

export class OpBuildTaskProvider implements vscode.TaskProvider {
    static OpenplanetTaskType = 'Openplanet Remote Build';
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
        return new vscode.Task(definition, vscode.TaskScope.Workspace, 'Load/Reload from User Folder',
            OpBuildTaskProvider.OpenplanetTaskType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                return new OpBuildTaskTerminal(this.workspaceRoot, pluginId, openplanetPort);
            }), '$Openplanet Remote Build Problem Matcher: Angelscript Compiler');
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
        const openplanetDir: string = path.dirname(path.dirname(this.workspaceRoot));
        const openplanetLogPath: string = path.join(openplanetDir, 'Openplanet.log');
        let logStartSize: number = -1;
        let logEndSize: number = -1;

        this.getLogSize(openplanetLogPath, (size: number) => logStartSize = size)
        .then(() => this.doBuild())
        .catch((e) => {
            this.writeEmitter.fire('Error: ' + e.toString() + '\r\n');
            this.closeEmitter.fire(0);
        })
        .then(() => this.getLogSize(openplanetLogPath, (size: number) => logEndSize = size))
        .then(() => this.readLog(openplanetLogPath, logStartSize, logEndSize))
        .then(() => {
            this.closeEmitter.fire(0);
        });

    }

    close(): void { }

    private async doBuild(): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            if (this.client === undefined) {
                this.client = new net.Socket();
            }

            this.client.on('data', (data) => {
                const message = JSON.parse(data.slice(4).toString());
                if (message.error) {
                    reject(message.error);
                } else {
                    resolve();
                }
            });

            this.client.on('error', (error: Error) => {
                reject(error);
            });

            this.client.connect(this.openplanetPort, 'localhost', () => {
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

    private async getLogSize(openplanetLogPath: string, setSize: (size: number) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.stat(openplanetLogPath, (error, stats) => {
                if (error) {
                    reject('Unable to access Openplanet.log');
                } else {
                    setSize(stats.size);
                    resolve();
                }
            });
        });
    }

    private async readLog(openplanetLogPath: string, logStartSize: number, logEndSize: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.open(openplanetLogPath, 'r', (error, fd) => {
                if (error) {
                    reject('Unable to access Openplanet.log');
                } else {
                    let buf = Buffer.alloc(logEndSize - logStartSize);
                    fs.read(fd, buf, 0, logEndSize - logStartSize, logStartSize, (error, count, buffer) => {
                        const logString = buffer.toString('utf8');
                        const logLines = logString.split(/\r\n|\r|\n/);
                        for (let i = 0; i < logLines.length; ++i) {
                            this.printLogLine(logLines[i]);
                            if (logLines[i].indexOf('Loaded plugin') >= 0) {
                                break;
                            }
                        }
                        resolve();
                    });
                }
            });
        });
    }

    private printLogLine(rawLine: string): void {
        let getNextBrackets = (line: string, startOffset: number): [number, string] => {
            const startIndex = line.indexOf('[', startOffset);
            const endIndex = line.indexOf(']', startIndex);
            return [endIndex + 1, line.slice(startIndex + 1, endIndex).trim()];
        };
        let index: number = 0;
        let source: string = '';
        let time: string = '';
        let subject: string = '';
        [index, source] = getNextBrackets(rawLine, 0);
        if (rawLine.slice(index, index + 2) !== '  ') {
            [index, time] = getNextBrackets(rawLine, index);
            if (rawLine.slice(index, index + 2) !== '  ') {
                [index, subject] = getNextBrackets(rawLine, index);
            }
        }
        const RED: string = '\x1b[31m';
        const YELLOW: string = '\x1b[33m';
        const CLEAR: string = '\x1b[0m';

        let text: string = rawLine.slice(index + 2);
        if (text.indexOf(':  ERR :') >= 0) {
            text = RED + text + CLEAR;
        } else if (text.indexOf(': WARN :') >= 0) {
            text =  YELLOW + text + CLEAR;
        }

        this.writeEmitter.fire(text + '\r\n');
    }
}