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
    
    var panelOut, 
        panelArgs,
        cmdConfig,
        cmdSelected;
    
    var DEBUG = true;
    
     var cmdRunner = CommandManager.register("Open Command Runner", COMMAND_RUNNER, openSearch),
        fileMenu   = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
        
    //fileMenu.addMenuDivider();
    fileMenu.addMenuItem(cmdRunner);
        
    KeyBindingManager.addBinding(COMMAND_RUNNER, {key: "Ctrl-Shift-M"});
    
    
    // Realiza o parse do arquivo de configurar e carrega os comandos na
    // variavel de configuracao geral.
    function parseCfgFile(cfgData) {
        try {
            var cfg = JSON.parse(cfgData);

            if (cfg) {
                cmdConfig = cfg;
            }

        } catch(err) {
            appendOutput('Erro ao carregar o arquivo package.json: ' + err);
            cmdConfig = [];
        }
    }
    
    // Funcao que carrega o arquivo de configuracao do executor de comandos.    
    function loadCmdRunnerFile() {
        var rootPath = ProjectManager.getProjectRoot().fullPath;
        var cmdCfgFile = FileSystem.getFileForPath(rootPath + 'cmdrunner.json');
        
        FileUtils.readAsText(cmdCfgFile).done(function (rawText) {
            parseCfgFile(rawText);
        });
    }
    
    $(ProjectManager).on('projectOpen projectRefresh', loadCmdRunnerFile);
    $(DocumentManager).on("documentSaved", function(evt, doc) {
        console.log(doc.file.name ); 
        if (doc.file.name == 'cmdrunner.json') {
            loadCmdRunnerFile();
        }
    });
    
    // Funcao que executa comandos atraves do NodeJS
    var execCmdFnc = function(cmd, args, opts, callback) {
        alert('Can not run the command, because NodeJS bridge not loaded!');
    };
    
    // Adiciona o texto fornecido no painel inferior.
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
            elem.append('<div>' + Mustache.render('{{row}}', {row: row}) + '</div>');            
        });
        
        panelOut.show();
        
        elem.animate({ scrollTop: elem[0].scrollHeight }, "slow");
    }
    
    // Exibe paneil inferior para fornecer parametros para o comando.
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
            
            input.keypress(function(evt) {
                if (evt.which === 13) {
                    var command = cmdSelected.cmd;
                    var args = $('#brackets-cmd-runner-args-val').val().split(':');
                    
                    appendOutput(' \nExecuting: ' + command + JSON.stringify(args));
                    
                    execCmdFnc(command, args, null, function(data) {
                        appendOutput(data);
                        
                        // Fechar antes nao esta funcionado.... =(
                        btnClose.click();
                    });
                }
            });
        } 
        
        $('#brackets-cmd-runner-args-text').html(cmdSelected.cmd);
        $('#brackets-cmd-runner-args-val').val(cmdSelected.args);
        
        panelArgs.show();
        
        //TODO Melhorar
        setTimeout(function() {
            var ipt = $('input', $('#brackets-cmd-runner-args'));
            
            ipt.focus();
            ipt.select();
            
        }, 350);
    }
    
    function openSearch() {
        QuickOpen.beginSearch("#", "");
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
    
    // Helper function that chains a series of promise-returning
    // functions together via their done callbacks.
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
            
            promise.fail(function (err) {
                console.error("[brackets-tekton] execution: '" + cmd + "'", err);
                
                if (DEBUG) alert("Erro cmd: " + JSON.stringify(err));
            });
            
            promise.done(function (data) {
                if (callback && typeof callback === 'function') {
                    callback(data);
                }
            });
        }
        
        execCmdFnc = execCmd;

        chain(connect, loadBridge);
    });
});
