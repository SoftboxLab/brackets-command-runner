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
    
    var panelOutHtml  = require("text!html/panel_output.html");
    var panelArgsHtml = require("text!html/panel_args.html");
    
    var panelOut,       // Painel de saida.
        panelArgs,      // Painel utilizado para entrada de argumentos.
        cmdConfig,      // Configuracoes do projeto.
        cmdSelected;    // Comando corrente selecionado.
    
    var DEBUG = true;   // Debug
    
    var cmdRunner = CommandManager.register("Open Command Runner", COMMAND_RUNNER, openSearch),
        fileMenu  = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    
    // Funcao que executa comandos atraves do NodeJS
    var execCmdFnc = function(cmd, args, opts, callback) {
        alert('Can not run the command, because NodeJS bridge not loaded!');
    };
        
    //fileMenu.addMenuDivider();
    fileMenu.addMenuItem(cmdRunner);
        
    KeyBindingManager.addBinding(COMMAND_RUNNER, {key: "Ctrl-Shift-M"});
    
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
     * Realiza o parse do arquivo de configuracao, remove todos os eventos associados anteriormente
     * e por fim carregar as novas configuracoes.
     *
     * @param {string} cfgData String contendo as informacoes de configuracao.
     */
    function loadConfigs(cfgData) {
        try {
            var cfg = JSON.parse(cfgData);

            if (!cfg) {
                return;                
            }
                                    
            unbindAllHotkeys();
            
            cmdConfig = cfg;
            
            for (var i = 0; i < cmdConfig.length; i++) {
                var cmd = cmdConfig[i];
                
                if (cmd.key) {
                    var cmdObj = CommandManager.register(cmd.label, COMMAND_RUNNER + '.cmd-' + i, createCommand(cmd));
                    
                    KeyBindingManager.addBinding(cmdObj, {key: cmd.key});                    
                }
            }
        } catch(err) {
            appendOutput('Erro ao carregar o arquivo cmdrunner.json: ' + err);
            cmdConfig = [];
        }
    }
    
    /**
     * Carrega o arquivo de configuracao do executor de comandos.
     */
    function readConfigFile() {
        var rootPath   = ProjectManager.getProjectRoot().fullPath,
            cmdCfgFile = FileSystem.getFileForPath(rootPath + 'cmdrunner.json');
        
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
    function appendOutput(output) {
        if (!panelOut) {
            panelOut = PanelManager.createBottomPanel(COMMAND_RUNNER + '.output', $(panelOutHtml));
            
            $('.close', $('#brackets-cmd-runner-output')).click(function() {
                panelOut.hide();
            });
        }
        
        var elem = $('#brackets-cmd-runner-console');

        output = output || '';
        
        output.split('\n').forEach(function(row) {
            elem.append('<div>' + Mustache.render('{{row}}', {row: row}) + '&nbsp;</div>');            
        });
        
        panelOut.show();
        
        elem.animate({ scrollTop: elem[0].scrollHeight }, "slow");
    }
    
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
    
    function buildCommand(command, params, args, argsDefault) {    
        for (var i = 0; i < params.length; i++) {
            var idx = parseInt(params[i]);
            
            var value = '';
            
            if (!isNaN(idx)) {
                value = args[idx] ? args[idx] : (argsDefault[idx] ? argsDefault[idx] : '');
            }
            
            command = command.replace(new RegExp('\\$' + params[i], 'g'), value);
        }
        
        return command;
    }
    
    function runCommand(objCmd, args, btnClose) {
        var opts = {
            defaultPath: ProjectManager.getProjectRoot().fullPath
        };
        
        var command = buildCommand(objCmd.cmd, getParams(objCmd.cmd), args, objCmd.args);

        appendOutput('Executing: ' + command);

        execCmdFnc(command, null, opts, function(err, data) {
            appendOutput(data);

            // Fechar antes nao esta funcionado.... =(
            btnClose.click();
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
                panelArgs.hide();
                panelArgs.remove();
                
                panelArgs = null;
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
                    runCommand(cmdSelected, $('#brackets-cmd-runner-args-val').val().split(':'), btnClose);
                }                
            });
        } 
        
        $('#brackets-cmd-runner-args-text').html(cmdSelected.cmd);
        $('#brackets-cmd-runner-args-val').val(cmdSelected.args);
        
        // So exibe a caixa de argumentos, se existir pelo menos uma marcacao 
        // de parametros na construcao do comando.
        if (getParams(cmdSelected.cmd).length === 0) {
            runCommand(cmdSelected, '', btnClose);
            
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
            var promise = nodeConnection.domains.nodebridge.execCmd(cmd, args, options);
            
            promise.fail(function (err, data) {
                console.error("[brackets-tekton] execution: '", arguments);
                
                //if (DEBUG) alert("Erro cmd: " + JSON.stringify(err));
                
                //appendOutput('Error when executing supplied command: ' + cmd + (args || []).join(' '));
                //appendOutput(data);
                
                if (callback && typeof callback === 'function') {
                    callback(err, data);
                }
            });
            
            promise.done(function (data) {
                if (callback && typeof callback === 'function') {
                    callback(false, data);
                }
            });
        }
        
        execCmdFnc = execCmd;

        chain(connect, loadBridge);
    });
});
