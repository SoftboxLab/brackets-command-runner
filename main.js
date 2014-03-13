/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

// Bracket extension. Permite que o desenvolvedor crie atalhos para os comandos de console.
define(function (require, exports, module) {
    "use strict";
    
    var AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        NodeDomain          = brackets.getModule("utils/NodeDomain"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
        Menus               = brackets.getModule("command/Menus"),
        QuickOpen           = brackets.getModule("search/QuickOpen"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        StatusBar           = brackets.getModule("widgets/StatusBar"),
        FileSystem          = brackets.getModule("filesystem/FileSystem"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        PanelManager        = brackets.getModule("view/PanelManager"),
        Resizer             = brackets.getModule('utils/Resizer'),
        DocumentManager     = brackets.getModule("document/DocumentManager");
    
    // Id do plugin
    var COMMAND_RUNNER = "br.com.softbox.brackets.plugin.commandrunner";
    var COMMAND_RUNNER_KILL = COMMAND_RUNNER + '.kill';
    
    var panelOutHtml  = require("text!html/panel_output.html");
    var panelArgsHtml = require("text!html/panel_args.html");
    
    var panelOut,       // Painel de saida.
        panelArgs,      // Painel utilizado para entrada de argumentos.
        cmdConfig,      // Configuracoes do projeto.
        cmdSelected;    // Comando corrente selecionado.
    
    var DEBUG = true;   // Debug
    
    var cmdRunner = CommandManager.register("Open Command Runner", COMMAND_RUNNER, openSearch),
        cmdKill   = CommandManager.register("Kill Commands", COMMAND_RUNNER_KILL, killCommands),
        fileMenu  = Menus.getMenu(Menus.AppMenuBar.FILE_MENU),
        cmdsMenu  = Menus.addMenu('Commands', COMMAND_RUNNER + '-menu', Menus.BEFORE, Menus.AppMenuBar.HELP_MENU),
        regCount  = 0,
        cmdId     = 0;
    
    var hotkeyPressed = false;
    
    var systemParams = {
        selectedFile: function(opts) {
            var doc = DocumentManager.getCurrentDocument();
            
            if (!doc) {
                return '';
            }
            
            //opts.defaultPath = doc.file.parentPath;
            
            return doc.file.name;
        },
        
        dirOfSelectedFile: function(opts) {
            var doc = DocumentManager.getCurrentDocument();
            
            if (!doc) {
                return opts.defaultPath;
            }
            
            //console.log(doc.file.parentPath);
            
            return doc.file.parentPath;
        }
    };
    
    /*$(document).keydown(function(evt) {
        if (hotkeyPressed 
                && evt.shiftKey 
                && evt.ctrlKey
                && String.fromCharCode(evt.which).toUpperCase() == 'K') {
            
        }
    });*/
    
    // Funcao que executa comandos atraves do NodeJS
    var execCmdFnc = function(cmd, args, opts, callback) {
        alert('Can not run the command, because NodeJS bridge not loaded!');
    };
    
    var killCmdFnc = function() {
        alert('Can not run kill command, because NodeJS bridge not loaded!');
    }
        
    //fileMenu.addMenuDivider();
    fileMenu.addMenuItem(cmdRunner);
    
    cmdsMenu.addMenuItem(cmdKill);
    cmdsMenu.addMenuItem(CommandManager.register("Clear Console", COMMAND_RUNNER + '.clear.console', function() {
        var elem = $('#brackets-cmd-runner-console').html('');
    }));
    cmdsMenu.addMenuItem(CommandManager.register("Show Console", COMMAND_RUNNER + '.show.console', function() {
        appendOutput('');
    }));
    cmdsMenu.addMenuItem(CommandManager.register("Hide Console", COMMAND_RUNNER + '.hide.console', function() {
        if (panelOut) {
            panelOut.hide();
        }
    }));    
    cmdsMenu.addMenuDivider();
    
    KeyBindingManager.addBinding(COMMAND_RUNNER, {key: "Ctrl-Shift-M"});
    KeyBindingManager.addBinding(COMMAND_RUNNER_KILL, {key: "Ctrl-Shift-K"});
    
    function killCommands() {
        killCmdFnc('nop');
    }
    
    /**
     * Remove todas as hotkeys associadas.
     */
    function unbindAllHotkeys() {
        if (!cmdConfig) {
            return;
        }
        
        for (var i = 0; i < cmdConfig.length; i++) {
            var cmd = cmdConfig[i];

            if (cmd.key) {
                KeyBindingManager.removeBinding(cmd.key);
            }
            
            if (cmd.cmdID) {
                cmdsMenu.removeMenuItem(cmd.cmdID);
            }
        }
    }
    
    /**
     * Cria uma funcao de evento para execucao de uma tecla de atalho.
     */
    function createCommand(cmd) {
        return function() {
            cmdSelected = cmd;

            showInputArgs();
        };
    }
    
    /**
     * Realiza o parse do arquivo de configuracao e carrega as novas configuracoes.
     *
     * @param {string} cfgData String contendo as informacoes de configuracao.
     */
    function loadConfigs(cfgData) {
        try {
            var cfg = JSON.parse(cfgData);

            if (!cfg) {
                return;                
            }
                                    
            cmdConfig = cfg;
            
            for (var i = 0; i < cmdConfig.length; i++) {
                var cmd = cmdConfig[i];
                
                cmd.cmdID = COMMAND_RUNNER + '.cmd-' + regCount++;

                var cmdObj = CommandManager.register(cmd.label, cmd.cmdID, createCommand(cmd));

                cmdsMenu.addMenuItem(cmdObj);
                
                if (cmd.key) {
                    KeyBindingManager.addBinding(cmdObj, {key: cmd.key});      
                }                
            }
        } catch(err) {
            appendOutput('Erro ao carregar o arquivo cmdrunner.json: ' + err);
            cmdConfig = [];
        }
    }
    
    /**
     * Inicialmente remove todos os eventos associados anteriormente e entao
     * carrega o arquivo de configuracao do executor de comandos caso exita.
     */
    function readConfigFile() {
        var rootPath   = ProjectManager.getProjectRoot().fullPath,
            cmdCfgFile = FileSystem.getFileForPath(rootPath + 'cmdrunner.json');
        
        unbindAllHotkeys();
        
        FileUtils.readAsText(cmdCfgFile).done(function (rawText) {
            loadConfigs(rawText);
        });
    }
    
    // Eventos que determinam a carga do arquivo de configuracao do cmd runner.
    $(ProjectManager).on('projectOpen projectRefresh', readConfigFile);
    $(DocumentManager).on("documentSaved", function(evt, doc) {
        if (doc.file.name == 'cmdrunner.json') {
            readConfigFile();
        }
    });
    
    /**
     * Adiciona o texto fornecido no painel inferior.
     *
     * @param {string} output String contendo o texto que sera adicionado ao painel de saida.
     */
    function appendOutput(output, color) {
        if (!panelOut) {
            panelOut = PanelManager.createBottomPanel(COMMAND_RUNNER + '.output', $(panelOutHtml));
            
            $('.close', $('#brackets-cmd-runner-output')).click(function() {
                panelOut.hide();
            });
        }
        
        var elem = $('#brackets-cmd-runner-console');

        output = output || '';
        color = color || 'white';
        
        var tmplate = [];
        
        elem.append('<span style="color: ' + color + '">' + Mustache.render('{{row}}', {row: output}) + '</span>');            
        
        panelOut.show();
        
        elem.animate({ scrollTop: elem[0].scrollHeight }, "slow");
    }
    
    /**
     * Retorna um array com os parametros do tipo $digito fornecido no comando.
     * @param {string} command String do comando que podera ser executado.
     * 
     * @return Array com os paramentros fornecidos na stringo do comando.
     */
    function getParams(command) {
        var re = /\$[0-9]+/g,
            matches = [],
            m;

        while ((m = re.exec(command)) !== null) {
            m = m[0].substr(1);
            
            if (m.match('[0-9]+')) {
                matches.push(m);
            }
        }

        return matches;
    }
    
    /**
     * Constroi o comando mesclando os parametros com o template da string do comando.
     * @param {string} command String do comando que podera ser executado.
     * @param {array} params Array que contem os parametros especificados na string do comando.
     * @param {array} args Array de argumentos informados pelo usuario.
     * @param {array} argsDefault Array de argumentos padrao informados no arquivo cmdrunner.json.
     *
     * @return String do comando meclado com os parametros pronto para ser executado.
     */
    function buildCommand(command, params, args, argsDefault, opts) {    
        for (var i = 0; i < params.length; i++) {
            var idx = parseInt(params[i]);
            
            var value = '';
            
            if (!isNaN(idx)) {
                value = args[idx] ? args[idx] : (argsDefault[idx] ? argsDefault[idx] : '');
            }
            
            command = command.replace(new RegExp('\\$' + params[i], 'g'), replaceSystemParams(value, opts));
        }
        
        return command;
    }
    
    /**
     * Obtem as opcoes extras fornecidas para o comando meclando-as com as opcoes de execucao padrao.
     * @return {object} Objeto que contem as informacoes extras para execucao do comando.
     */
    function getOpts(objCmd) {
        var defaultOpts = {
            defaultPath: ProjectManager.getProjectRoot().fullPath
        };
        
        var opts = $.extend({}, defaultOpts, objCmd.opts);
        
        //TODO Melhorar!
        if (opts.defaultPath 
            && typeof opts.defaultPath == "string" 
            && opts.defaultPath.length > 0 
            && opts.defaultPath.charAt(0) === '.') {
            opts.defaultPath = defaultOpts.defaultPath + '/' + opts.defaultPath;
        }
        
        opts = replaceSystemParams(opts, opts);
        
        opts.id = cmdId++ + '';
        
        return opts;
    }
    
    function replaceSystemParams(command, opts) {
        if (command == null) {
            return null;
        }
        
        if (typeof command === 'string') {
            var newCommand = command;
        
            for (var param in systemParams) {

                var paramValue = systemParams[param](opts);

                while ((command = command.replace('$' + param, paramValue)) != newCommand) {
                    newCommand = command;
                }
            }

            return command;
        }
        
        if (typeof command === 'object') {
            var newCmd = command instanceof Array ? [] : {};
            
            for (var elem in command) {
                newCmd[elem] = replaceSystemParams(command[elem], opts);
            }
            
            return newCmd;
        }    
        
        return command;
    }
    
    /**
     * Executa o comando fornecido e imprime a saida no painel.
     *
     * @param {object} objCmd Objeto que contem as informacoes do comando que sera executado.
     * @param {array} args Array com os argumentos fornecidos pelo usuario.
     * @param {DOMElem} btnClose Botao que fecha o painel de input de argumentos.
     */
    function runCommand(objCmd, args, btnClose) {
        var opts = getOpts(objCmd);
        
        var command = buildCommand(objCmd.cmd, getParams(objCmd.cmd), args, objCmd.args, opts);
        
        command = replaceSystemParams(command, opts);

        appendOutput('Executing: ' + command + '\n');

        execCmdFnc(command, null, opts, function(err, data) {
            appendOutput(data, err ? 'red' : 'white');
        });
    }
    
    /** 
     * Exibe paneil inferior para fornecer parametros para o comando.
     */
    function showInputArgs() {
        if (!panelArgs) {
            panelArgs = PanelManager.createBottomPanel(COMMAND_RUNNER + '.args', $(panelArgsHtml), 40);

            var btnClose = $('.close', $('#brackets-cmd-runner-args'));
            
            btnClose.click(function() {
                if (panelArgs) {
                    panelArgs.hide();                
                }                
            });    
            
            var input = $('input', $('#brackets-cmd-runner-args'));
            
            input.focusout(function() {
                btnClose.click();
            });
            
            input.keydown(function(evt) {
                if (evt.which === 27) {
                    btnClose.click();
                }
            });
            
            input.keypress(function(evt) {
                if (evt.which === 13) {
                    btnClose.click();
                    
                    runCommand(cmdSelected, $('#brackets-cmd-runner-args-val').val().split(':'));
                }                
            });
        } 
        
        $('#brackets-cmd-runner-args-text').html(cmdSelected.cmd);
        $('#brackets-cmd-runner-args-val').val(cmdSelected.args);
        
        // So exibe a caixa de argumentos, se existir pelo menos uma marcacao 
        // de parametros na construcao do comando.
        if (getParams(cmdSelected.cmd).length === 0) {
            runCommand(cmdSelected, '');
            
        } else {
            panelArgs.show();
        }
        
        //TODO Melhorar
        setTimeout(function() {
            var ipt = $('input', $('#brackets-cmd-runner-args'));
            
            ipt.focus();
            ipt.select();
            
        }, 350);
    }
    
    /**
     * Abre o paneil de busca de comandos.
     */
    function openSearch() {
        QuickOpen.beginSearch("#", "");
        
        hotkeyPressed = true;
        
        setTimeout(function() {
            hotkeyPressed = false;
        }, 300);
    } 
    
    /**
     * Helper function that chains a series of promise-returning functions together via their 
     * done callbacks.
     */
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }
    
    QuickOpen.addQuickOpenPlugin({
        name: "Command Runner",
        label: "Command Runner",  // ignored before Sprint 34
        languageIds: [],  // empty array = all file types  (Sprint 23+)
        fileTypes:   [],  // (< Sprint 23)
        done: function () {},
        search: function(query) {
            var cmd = query.substr(1);
            
            var ret = cmdConfig.filter(function(elem) {
                return cmd.length === 0 || elem.cmd.indexOf(cmd) >= 0 || elem.label.indexOf(cmd) >= 0;
            });
            
            return ret;
            
        },
        
        match: function(query) {
            return query.length > 0 && query.charAt(0) === '#';
        },
        
        //itemFocus: function () {},
        
        itemSelect: function(item) {
            cmdSelected = item;
            
            showInputArgs();
        },
        
        /*resultsFormatter: function(item) {
            var displayName = highlightMatch(item);
            return "<li>" + displayName + "</li>";
        },*/
        
        matcherOptions: { segmentedSearch: true }
    });
    

    // Inicia conexao com NodeJS
    AppInit.appReady(function () {
        var path = ExtensionUtils.getModulePath(module, "node/NodeBridgeDomain");
        
        var nodeConnection = new NodeConnection();
        
        $(nodeConnection).on("nodebridge.update", function(evt, data) {
            var idx = data.indexOf(':');

            var ret = data.substr(0, idx);

            data = data.substr(idx + 1);
            
            appendOutput(data, ret === 'err' ? 'red' : 'white');
        });
        
        // Inicia a conexao com o NodeJS.
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            
            connectionPromise.fail(function (err) {
                console.error("[brackets-tekton] failed to connect to node: ", err);
                if (DEBUG) alert("Erro connect: " + JSON.stringify(err));
            });
            
            return connectionPromise;
        }
        
        // Inicia a bridge que executara os comandos
        function loadBridge() {
            var path = ExtensionUtils.getModulePath(module, "node/NodeBridgeDomain");
            
            var loadPromise = nodeConnection.loadDomains([path], true);
            
            loadPromise.fail(function (err) {
                console.log("[brackets-tekton] failed to load domain: ", err);
                
                if (DEBUG) alert("Erro loadBridge: " + JSON.stringify(err));
            });
            
            return loadPromise;
        }
        
        // Executa comando a atraves da bridge do NodeJS.
        function execCmd(cmd, args, options, callback) {
            if (!nodeConnection.domains.nodebridge) {
				if (count > 5) {
					appendOutput("Was not possible execute command '" + cmd + "' because NodeJS not started!\n");
					return;
				}
			
				appendOutput('Waiting for NodeJS..\n');
			
                setTimeout(function() {
                    execCmd.call(null, cmd, args, options, callback, (count || 1) + 1);
                }, 1000);
				return;
            }
            
            var promise = nodeConnection.domains.nodebridge.execCmd(cmd, args, options);
            
            promise.fail(function (err, data) {
                console.error("[brackets-tekton] execution: '", arguments);

                appendOutput('Error when executing supplied command: ' + cmd + (args || []).join(' ') + ' Log: ' + err);
            });
            
            promise.done(function (data) {
                //funOutData(data);
            });
        }
        
        function killCmd(id) {
            if (!nodeConnection.domains.nodebridge) {
                return;
            }
            
            var promise = nodeConnection.domains.nodebridge.killCmd(id);
            
            promise.fail(function (err, data) {
                console.error("[brackets-tekton] kill execution: '", arguments);
                
                appendOutput('Error when executing kill command!', 'red');
            });
            
            promise.done(function (data) {
                appendOutput('Killed!');
            });
            
            appendOutput('Sent kill command.\n');
        }
        
        execCmdFnc = execCmd;
        killCmdFnc = killCmd;

        chain(connect, loadBridge);
    });
});
