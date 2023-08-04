# Openplanet Remote Build Tasks Extension

This extension adds build tasks for compiling [Openplanet](https://openplanet.dev/) plugins. The tasks communicate
with the [Remote Build](https://openplanet.dev/plugin/remotebuild) plugin to trigger script compilation and this must
be installed for the tasks to work.

Create the simplest build task by opening the vscode workspace in your plugin directory so that the `info.toml` file is
in the root directory.

If you are working out of the OpenplanetX/Plugins/\<MyPlugin\> folder then you will be presented with the "Openplanet
Remote Build: Load/Reload from User Folder" build task. This task creates a standalone task which will run entirely
inside the vscode extension sending commands to Openplanet and receiving feedback from the build.
