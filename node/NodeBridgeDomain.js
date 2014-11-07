(function () {
    "use strict";

    var fs = require('fs');

    var domainManager = null;

    // Comandos executados pelo usuario
    var commands = {};

    // Log de debug
    var LOG_FILE = '/tmp/nodebridge.log';

    // Habilita info de debug.
    var DEBUG = false;

    /**
     * Adiciona as informacoes fornecidas em um arquivo de log.
     */
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

        DEBUG && fs.appendFile(LOG_FILE, arrLog.join(' ') + '\n');
    }

    /**
     * Executa as configuracoes do abiente de acordo com as opcoes fornecidas no comando.
     */
    function execConfis(options) {
        if (!options) {
            return;
        }

        // Alteracoes de diretorio corrente.
        if (options.defaultPath) {
            try {
                process.chdir(options.defaultPath);
            } catch (err) {
                log('Error changing to default path: ', err);
            }
        }

        // Arquivo de log.
        if (options.logFile) {
            LOG_FILE = options.logFile;
        }
    }

    /**
     * Executa o kill para todos os processo em execucao.
     *
     * @param id {string} Idenficador do comando que sera finalizado (uso futuro).
     */
    function killCmd(id) {
        //TODO melhorar apenas para o comando de id fornecido.

        var hasErr = false;

        for (var id in commands) {
            // Nao executa o kill dos comandos kill.
            if (id.match(/-kill$/ig)) {
                log('Ignore kill', id);
                continue;
            }

            var terminal = commands[id].terminal;

            log('Killing: ', id);

            try {
                terminal.kill();

                log('Send kill ok!');

                if (commands[id].opts.killCmd) {
                    // Clonando as opcoes do comando original.
                    var killOpts = JSON.parse(JSON.stringify(commands[id].opts));

                    killOpts.id = killOpts.id + '-kill';

                    // Enviando comando de kill informado pelo usuario.
                    execCmd(commands[id].opts.killCmd, null, killOpts);
                }
            } catch (err) {
                log('Err kill', err);

                hasErr = true;
            }
        }

        return hasErr ? "err" : "ok";
    }

    /**
     * Realiza a execucao do comando informado.
     *
     * @param cmd {string} Comando que sera executado.
     * @param args {array} Argumentos necessarios para a execucao do comando.
     * @param optios {object} Opcoes de configuracao do ambiente de execucacao.
     */
    function execCmd(cmd, args, options, callback) {
        args = args || [];

        execConfis(options);

        var os       = require('os');
        var spawn    = require('child_process').spawn;
        var osCmd    = 'bash';    // *nix systems (eg. osx, linux)

        if (/^win/.test(os.platform())) {
            // No win: cmd /c start cmd.exe
            osCmd = 'cmd';

            args.push('/K');
        } else {
            args.push('-l');
        }

        var terminal = spawn(osCmd, args);
        var hiddenConsole = options.hiddenConsole || false;

        commands[options.id] = {
            terminal: terminal,
            opts: options
        };

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
        terminal.stdin.end();
    }

    /**
     * Inicia a bridge que recebera os comandos efetuados no Brackets.
     */
    function init(DomainManager) {
        domainManager = DomainManager;

        if (!domainManager.hasDomain("nodebridge")) {
            domainManager.registerDomain("nodebridge", {
                major: 0,
                minor: 1
            });
        }

        domainManager.registerCommand(
            "nodebridge",
            "execCmd",
            execCmd,
            true,
            "Executa o comandos com o Nodejs.", ["command", "args", "options"], [{
                name: "result",
                type: "object",
                description: "Resultado da execução."
            }]
        );

        domainManager.registerEvent(
            "nodebridge",
            "update", [{
                name: "data",
                type: "object"
            }]
        );

        domainManager.registerCommand(
            "nodebridge",
            "killCmd",
            killCmd,
            true,
            "Termina comandos já iniciados.", ["id"], [{
                name: "result",
                type: "string",
                description: "Resultado do comando kill execução."
            }]
        );
    }

    exports.init = init;
}());
