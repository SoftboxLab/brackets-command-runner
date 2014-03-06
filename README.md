brackets-command-runner
=======================

Bracktes extension that allow develper add dynamically hotkeys for command line tools.

Usage
=====

Create a file "cmdrunner.json" inside of your project folder. Use cmdrunner.json of this project as example.


The file cmdrunner.json is a JSON file that contains the configuration of commands. Must contains a array with command objects. The command object has follwing structure:

{
    "label": "Label that show in menus and quick search",
    
    "cmd": "Command line that will be executed. You can use $0, $1, ... $n to specify custom arguments, that will be propted for user.",
    
    "args": [ Array the contains default arguments, in case user supply anything. ],
    
    "key": "Hotkey that will perform a quick access to command."
}