(function () {
    "use strict";

    var domainManager = null;

    var fs = require('fs');
    var commands = {};

    var LOG_FILE = '/tmp/nodebridge.log';

    function log() {
        var elems = Array.prototype.splice.call(arguments, 0);
        var arrLog = [];

        elems.forEach(function(elem) {
            var msg = elem;

            if (typeof elem !== 'string') {
                msg = JSON.stringify(elem);     
            }

            arrLog.push(msg);
        });

        fs.appendFile(LOG_FILE, arrLog.join(' ') + '\n');
    }
    
    function execConfis(options) {
        if (!options) {
            return;
        }
        
        if (options.defaultPath) {
            try {
                process.chdir(options.defaultPath);
            } catch (err) {
                log('Error changing to default path: ', err);
            }
        }

        if (options.logFile) {
            LOG_FILE = options.logFile;
        }
    }

    /*
    function execCmd(cmd, args, options, callback) {
        var exec = require('child_process').exec;
        var child;

        args = args || [];
        
        execConfis(options);

        log('ExecCmd: ', cmd, args, options);

        child = exec(cmd + ' ' + args.join(' '), function (error, stdout, stderr) {
            log(error ? ('Exec Ok!') : ('Exec fail'));
            log('stdout', stdout, 'stderr', stderr);

            callback(false, (error ? 'err:' : 'ok:') + stdout + stderr);
        });
    }
    */
    
    function killCmd(id) {
        //TODO melhorar apenas para o comando de id fornecido.
        
        var hasErr = false;
        
        for (var id in commands) {
            log('Killing: ', id);
            log('Killing connected: ', commands[id].connected);
            
            try {
                commands[id].stdin.write('\x04');
                commands[id].stdin.write('\n');
                commands[id].stdin.write('\x04');
                commands[id].stdin.write('\n');
                commands[id].stdin.end();
                commands[id].kill();

                log('kill ok!');
            } catch (err) {
                log('Err kill', err);

                hasErr = true;
            }
        }
                    
        return hasErr ? "err" : "ok";
    }
    
    function execCmd(cmd, args, options, callback) {
        args = args || [];

        execConfis(options);
        
        var os       = require('os');
        var spawn    = require('child_process').spawn;        
        var osCmd    = 'bash';
            
        if (os.platform().toLowerCase().indexOf('linux') == -1) {
            // No win: cmd /c start cmd.exe            
            osCmd = 'cmd';
            
            args.push('/K');
            //args.push('start');
            //args.push('cmd.exe');
        }
    
        var terminal = spawn(osCmd, args);
        var hiddenConsole = options.hiddenConsole || false;
        
        commands[options.id] = terminal;

        log('ExecCmd: ', cmd, args, options);

        terminal.stdout.on("data", function (data) {
            log('Data: ', '' + data);

            domainManager.emitEvent("nodebridge", "update", [{
                data: '' + data, 
                err: false, 
                id: options.id, 
                hiddenConsole: hiddenConsole
            }]);
        });

        terminal.stderr.on("data", function (data) {
            log('Data: ', data + '');

            domainManager.emitEvent("nodebridge", "update", [{
                data: '' + data, 
                err: true, 
                id: options.id,
                hiddenConsole: hiddenConsole
            }]);
        });

        terminal.stdin.write(cmd + '\n');
        

        /* terminal.on('close', function(code) ->
            stdout = stdout.replace(/^\s+|\s+$/g, '')
            stdout = if stdout.length > 0 then stdout.split '\n' else []

            stderr = stderr.replace(/^\s+|\s+$/g, '')
            stderr = if stderr.length > 0 then stderr.split '\n' else []
        }*/
    }

    function init(DomainManager) {
        domainManager = DomainManager;

        if (!domainManager.hasDomain("nodebridge")) {
            domainManager.registerDomain("nodebridge", { major: 0, minor: 1 });
        }

        domainManager.registerCommand(
            "nodebridge",
            "execCmd",
            execCmd,
            true,
            "Executa o comandos com o Nodejs.",
            ["command", "args", "options"],
            [{name: "result",
              type: "object",
              description: "Resultado da execução."}]
        );
        
        domainManager.registerEvent(
            "nodebridge",
            "update",
            [{name: "data", type: "object"}]
        );
        
        domainManager.registerCommand(
            "nodebridge",
            "killCmd",
            killCmd,
            true,
            "Mata comandos já iniciados.",
            ["id"],
            [{name: "result",
              type: "string",
              description: "Resultado do comando kill execução."}]
        );
    }

    exports.init = init;
}());
