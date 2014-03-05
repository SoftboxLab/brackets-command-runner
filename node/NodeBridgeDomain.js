(function () {
    "use strict";

    var domainManager = null;

    var fs = require('fs');

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

    function execCmd(cmd, args, options, callback) {
        var exec = require('child_process').exec;
        var child;

        args = args || [];
        
        execConfis(options);

        log('ExecCmd: ', cmd, args, options);

        child = exec(cmd + ' ' + args.join(' '), function (error, stdout, stderr) {
            log('Exec Ok!');

            callback(error, stdout);
        });

        child.stdout.on("data", function (data) {
            log('Data: ', data);

            domainManager.emitEvent("nodeexec", "update", [data]);
        });
        
        child.stderr.on("data", function (data) {
            log('Data: ', data);

            domainManager.emitEvent("nodeexec", "update", [data]);
        });
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
              type: "string",
              description: "Resultado da execução."}]
        );
        domainManager.registerEvent(
            "nodebridge",
            "update",
            [{name: "data", type: "string"}]
        );
    }

    exports.init = init;
}());
