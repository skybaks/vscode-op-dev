# Openplanet Remote Build Tasks Extension

This extension adds build tasks for compiling [Openplanet](https://openplanet.dev/) plugins. The tasks communicate
with the [Remote Build](https://openplanet.dev/plugin/remotebuild) plugin to trigger script compilation and this must
be installed for the tasks to work.

![Remote Build Tasks](./img/remote-build-tasks.png)

## Setup

Install the Remote Build plugin in Openplanet. You can find it in the Plugin Manager by searching "Remote Build".

**[Optional]** You can then install the tm-remote-build python executable if you want the plugin to load happen as part
of a larger build script in plugin. Run `python -m pip install --upgrade tm-remote-build` to download and install the
latest version.

## Usage (Simple)

* Prerequisites
    * Workspace is located in ~/OpenplanetX/Plugins/\<MyPlugin\>
    * Workspace contains info.toml file in the root directory

Open vscode so your workspace is inside a plugin folder in the OpenplanetX/Plugins/ folder. If you also have a
info.toml file in the top level of your plugin folder than you will see the "Openplanet Remote Build: Load/Reload
from User Folder" task in the available list when you go to add a new task.

> NOTE: tm-remote-build is not required to be installed to use this custom build task. All parts of the loading are
> handled inside the VS Code extension.

Run this task to send a command to Openplanet and have the plugin in your workspace loaded.

## Usage (Custom)

* Prerequisites
    * None

If you have a custom build script to create a "shell"/"process" type task and configure it to call your script. Add the
following to your task definition in .vscode/tasks.json:
`"problemMatcher": [ "$Openplanet Remote Build Problem Matcher: Angelscript Compiler" ]`

Your task could look something like this:

```json
{
    "label": "Openplanet Remote Build Custom Shell",
    "type": "shell",
    "command": "./build.bat",
    "problemMatcher": [ "$Openplanet Remote Build Problem Matcher: Angelscript Compiler" ]
}
```

Refer to the [VS Code documentation](https://code.visualstudio.com/docs/editor/tasks#_custom-tasks) for help creating
a custom task.

It is expected that at some point in your build script you will call tm-remote-build to trigger the plugin to load.
