Command Runner
=======================

Bracktes extension that allow develper add dynamically hotkeys for command line tools.

Install
-------

1. Install [Brackets](http://download.brackets.io/) Sprint 36 or later.
2. In Brackets, click the menu item *File > Extension Manager...*
3. Go to the "Available" tab of the dialog that appears.
4. Type "Command Runner" in the search box.
5. Click the "Install" button in the search result for Command Runner.

Usage
-----

Create a file "cmdrunner.json" inside of your project folder. Use cmdrunner.json of this project as example.


The file cmdrunner.json is a JSON file that contains the configuration of commands. Must contains a array with command objects. The command object has follwing structure:

```
{
    "label": "string",
    
    "cmd": "string",
    
    "args": [ array ],
    
    "key": "string",
    
    "opts": {
        "defaultPath": "string",
        
        "hiddenConsole": bool
    }
}
```

Following is a description of each attribute:

**label:** Label that show in menus and quick search.

**cmd:** Command that will be executed. You can use $0, $1, ... $n to specify custom arguments, that will be propted for user.

**args:** Array that contains default arguments, in case user supply anything.

**key:** Hotkey that will perform a quick access to command.

**opts:** Optional attributes that configure some options of execution enviroment. 
    
**opts.defaultPath:** Directory path where command will executed.

**opts.hiddenConsole:** True indicates that output panel will not open after command execution.

Screenshots
-----------

![Screenshot of quick open menu](https://raw.github.com/tarcisiojr/brackets-command-runner/screenshots/shot01.png)
![Screenshot of output panel](https://raw.github.com/tarcisiojr/brackets-command-runner/screenshots/shot02.png)
![Screenshot of input arguments](https://raw.github.com/tarcisiojr/brackets-command-runner/screenshots/shot03.png)
![Screenshot of commands menu](https://raw.github.com/tarcisiojr/brackets-command-runner/screenshots/shot04.png)


Change log
----------

## 0.0.13

Features:
    - Color on output (thanks for partageit suggestion).

## 0.0.12

Features:

    - Specific menu "Commands"
    - Kill commands menu option
    - Show panel menu option
    - Hide panel menu option
    - Clear panel menu option
    - Add extra option hiddenConsole.
    
Bugfixes:

    - Fix output update on panel output.

License
-------

Command Runner is released under the [MIT license](http://opensource.org/licenses/MIT).
