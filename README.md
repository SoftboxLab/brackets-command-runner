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
    
    "key": "string"
}
```

Following description about each atributes:

**label:** Label that show in menus and quick search.

**cmd:** Command that will be executed. You can use $0, $1, ... $n to specify custom arguments, that will be propted for user.

**args:** Array that contains default arguments, in case user supply anything.

**key:** Hotkey that will perform a quick access to command.

License
-------

Theseus is released under the [MIT license](http://opensource.org/licenses/MIT).
