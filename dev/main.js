define(function (require, exports, module) {
    'use strict';

    var AppInit           = brackets.getModule('utils/AppInit'),
        EditorManager     = brackets.getModule('editor/EditorManager'),
        CodeHintManager   = brackets.getModule("editor/CodeHintManager"),
        PreferencesManager= brackets.getModule('preferences/PreferencesManager'),
        Menus             = brackets.getModule('command/Menus'),
        CommandManager    = brackets.getModule('command/CommandManager'),
        KeyEvent          = brackets.getModule('utils/KeyEvent'),
        FileSystem        = brackets.getModule('filesystem/FileSystem'),
        ExtensionUtils    = brackets.getModule('utils/ExtensionUtils'),

        snippets          = require('snippet'),
        enabled           = true,
        prefs             = PreferencesManager.getExtensionPrefs('mad-snippets'),
        COMMAND_NAME      = 'Enable Mad Snippets',
        COMMAND_ID        = 'madapbox.toggleMADSnippets';

		ExtensionUtils.loadStyleSheet(module, "style.css");
    // --- flatten nested snippets ---
    function flattenSnippets(obj, prefix = "") {
        let result = {};
        for (let key in obj) {
            if (typeof obj[key] === "string") {
                result[prefix + key] = obj[key];
            } else if (typeof obj[key] === "object") {
                Object.assign(result, flattenSnippets(obj[key], prefix + key + "-"));
            }
        }
        return result;
    }

    // --- get the last open tag before the cursor ---
    function getCurrentTag(editor) {
        var cursor = editor.getCursorPos();
        var textBeforeCursor = editor.document.getRange({ line: 0, ch: 0 }, cursor);
        var matches = [...textBeforeCursor.matchAll(/<([a-zA-Z-]+)\s[^>]*$/g)];
        if (!matches.length) return null;
        return matches[matches.length - 1][1];
    }

    // --- detect current editing context ---
    function getContext(editor) {
    var filePath = editor.document.file.fullPath;
    var fileExt = filePath.split('.').pop().toLowerCase();
    var cursor = editor.getCursorPos();
    var textBeforeCursor = editor.document.getRange({ line: 0, ch: 0 }, cursor);

    // PHP inside detection
    if (fileExt === "php") {
        var phpOpenTags = [...textBeforeCursor.matchAll(/<\?php/gi)].map(m => m.index);
        var phpCloseTags = [...textBeforeCursor.matchAll(/\?>/gi)].map(m => m.index);
        if (phpOpenTags.length > 0) {
            var lastOpen = phpOpenTags[phpOpenTags.length - 1];
            var lastClose = phpCloseTags.length > 0 ? phpCloseTags[phpCloseTags.length - 1] : -1;
            if (lastOpen > lastClose) return "phpinside"; // inside PHP
        }
		// Version detection
		var versionAttr = textBeforeCursor.match(/<(link|script)[^>]+?(href|src)\s*=\s*["'][^"']*\?(v?[^"']*)$/i);
		if (versionAttr) return "version";

		// CSS/JS detection
		var styleMatches = [...textBeforeCursor.matchAll(/<style[^>]*>/gi)];
		var styleEndMatches = [...textBeforeCursor.matchAll(/<\/style>/gi)];
		if (styleMatches.length > styleEndMatches.length) return "css";

		var scriptMatches = [...textBeforeCursor.matchAll(/<script[^>]*>/gi)];
		var scriptEndMatches = [...textBeforeCursor.matchAll(/<\/script>/gi)];
		if (scriptMatches.length > scriptEndMatches.length) return "javascript";

		// Inside a tag
		var tagOpenMatch = textBeforeCursor.match(/<([a-zA-Z-]+)\s[^>]*$/);
		if (tagOpenMatch) {
			var classAttrMatch = textBeforeCursor.match(/class\s*=\s*"[^"]*$/);
			if (classAttrMatch) return "inclass";

			var attrValueMatch = textBeforeCursor.match(/([a-zA-Z-]+)\s*=\s*["'][^"]*$/);
			if (attrValueMatch) return "inattr";

			return "tagattr";
		}
		
        return "php"; // outside <?php ?> still triggers snippetsPhp
    }

    // Version detection
    var versionAttr = textBeforeCursor.match(/<(link|script)[^>]+?(href|src)\s*=\s*["'][^"']*\?(v?[^"']*)$/i);
    if (versionAttr) return "version";

    // CSS/JS detection
    var styleMatches = [...textBeforeCursor.matchAll(/<style[^>]*>/gi)];
    var styleEndMatches = [...textBeforeCursor.matchAll(/<\/style>/gi)];
    if (styleMatches.length > styleEndMatches.length) return "css";

    var scriptMatches = [...textBeforeCursor.matchAll(/<script[^>]*>/gi)];
    var scriptEndMatches = [...textBeforeCursor.matchAll(/<\/script>/gi)];
    if (scriptMatches.length > scriptEndMatches.length) return "javascript";

    // Inside a tag
    var tagOpenMatch = textBeforeCursor.match(/<([a-zA-Z-]+)\s[^>]*$/);
    if (tagOpenMatch) {
        var classAttrMatch = textBeforeCursor.match(/class\s*=\s*"[^"]*$/);
        if (classAttrMatch) return "inclass";

        var attrValueMatch = textBeforeCursor.match(/([a-zA-Z-]+)\s*=\s*["'][^"]*$/);
        if (attrValueMatch) return "inattr";

        return "tagattr";
    }

    // Default by extension
    if (fileExt === "css") return "css";
    if (fileExt === "js") return "javascript";
    if (fileExt === "php") return "php"; // outside <?php ?> still triggers snippetsPhp
    return "html";
}


    // --- parse token before cursor ---
    function parseLine(line, cursorPosition, context) {
        line = line.substring(0, cursorPosition);
        if (context === "inclass") {
            var match = line.match(/([\w-]+)$/);
            return match ? match[1] : "";
        } else if (context === "inattr") {
            var match = line.match(/([a-zA-Z0-9_-]+)$/);
            return match ? match[1] : "";
        } else if (context === "tagattr") {
            var match = line.match(/([a-zA-Z-]*)$/);
            return match ? match[1] : "";
        } else if (context === "version") {
            var match = line.match(/\?([a-zA-Z0-9_-]*)$/);
            return match ? match[1] || "?" : "";
        } else {
            var match = line.match(/([a-zA-Z][a-zA-Z0-9_-]*)$/);
            return match ? match[0] : "";
        }
    }

    // --- helper to insert text + move cursor ---
    function insertSnippetText(editor, snippetText, cursorPosition, snippetKeyLength) {
        var startCh = cursorPosition.ch - snippetKeyLength;
        var start = { line: cursorPosition.line, ch: startCh };
        var focusIndex = snippetText.indexOf("#focus");
        var cleanSnippet = snippetText.replace("#focus", "");
        editor.document.replaceRange(cleanSnippet, start, cursorPosition);
        if (focusIndex !== -1) {
            var focusPos = { line: start.line, ch: start.ch + focusIndex };
            editor.setCursorPos(focusPos);
        }
    }

    // --- try load external snippet file ---
    function tryLoadExternalSnippet(snippetKey, callback) {
        var basePath = ExtensionUtils.getModulePath(module); 
        var filePath = basePath + "snippets/" + snippetKey + ".html";
        var fileEntry = FileSystem.getFileForPath(filePath);
        fileEntry.read(function (err, content) {
            if (err) callback(null);
            else callback(content);
        });
    }

    // --- expand snippet ---
    function expandSnippet(editor, snippetKey, cursorPosition, line) {
        var context = getContext(editor);
        if (context === "no-snippets") return false;

        var snippetSet;

        if (context === "css") snippetSet = flattenSnippets(snippets.css || {});
        else if (context === "javascript") snippetSet = flattenSnippets(snippets.js || {});
        else snippetSet = flattenSnippets(snippets[context] || {});

        var tag = getCurrentTag(editor);

        if (context === "tagattr" && tag && snippets[tag + "-tagattr"]) {
            for (let key in snippets[tag + "-tagattr"]) {
                if (key !== "class") snippetSet[key] = snippets[tag + "-tagattr"][key];
            }
        }

        if (context === "inclass") {
            const tagAttrKey = `${tag}-tagattr`;
            if (snippets[tagAttrKey] && snippets[tagAttrKey]["class"]) {
                const classSnippets = snippets[tagAttrKey]["class"];
                for (let key in classSnippets) snippetSet[key] = classSnippets[key];
            }
            if (snippets["inclass"]) Object.assign(snippetSet, flattenSnippets(snippets["inclass"]));
        }

        if (snippetSet[snippetKey]) {
            insertSnippetText(editor, snippetSet[snippetKey], cursorPosition, snippetKey.length);
            return true;
        }

        // external snippets for html/php
        if ((context === "html" || context === "php") && snippets.inSnippets && snippets.inSnippets[snippetKey]) {
            tryLoadExternalSnippet(snippetKey, function (content) {
                if (!content) return;
                insertSnippetText(editor, content, cursorPosition, snippetKey.length);
            });
            return true;
        }

        return true;
    }

    // --- key handlers ---
    function keyEventHandler($event, editor, event) {
        enabled = prefs.get('enabled');
        if (!enabled) return;

        if (event.type === 'keydown' && event.keyCode === KeyEvent.DOM_VK_TAB) {
            var cursorPosition = editor.getCursorPos();
            var line = editor.document.getLine(cursorPosition.line);
            var snippetKey = parseLine(line, cursorPosition.ch, getContext(editor));
            if (expandSnippet(editor, snippetKey, cursorPosition, line)) event.preventDefault();
        }
    }

    function enterHandler(event) {
        if (event.keyCode !== KeyEvent.DOM_VK_RETURN) return;
        var editor = EditorManager.getActiveEditor();
        if (!editor) return;
        var cursorPosition = editor.getCursorPos();
        var line = editor.document.getLine(cursorPosition.line);
        var snippetKey = parseLine(line, cursorPosition.ch, getContext(editor));
        if (expandSnippet(editor, snippetKey, cursorPosition, line)) event.preventDefault();
    }

    function activeEditorChangeHandler($event, focusedEditor, lostEditor) {
        if (lostEditor) {
            $(lostEditor).off('keyEvent', keyEventHandler);
            $(lostEditor).off('keydown', enterHandler);
        }
        if (focusedEditor) {
            $(focusedEditor).on('keyEvent', keyEventHandler);
            $(focusedEditor).on('keydown', enterHandler);
        }
    }

    // --- hint provider ---
    function MADHINTS() {
        this.editor = null;
        this.filteredKeys = [];
    }

    MADHINTS.prototype.hasHints = function(editor) {
        this.editor = editor;
        var cursor = editor.getCursorPos();
        var context = getContext(editor);
        if (context === "no-snippets") return false;

        var snippetSet;
        if (context === "css") snippetSet = flattenSnippets(snippets.css || {});
        else if (context === "javascript") snippetSet = flattenSnippets(snippets.js || {});
        else snippetSet = flattenSnippets(snippets[context] || {});

        var tag = getCurrentTag(editor);

        if (context === "tagattr" && tag && snippets[tag + "-tagattr"]) {
            for (let key in snippets[tag + "-tagattr"]) if (key !== "class") snippetSet[key] = snippets[tag + "-tagattr"][key];
        }

        if (context === "inclass") {
            const tagAttrKey = `${tag}-tagattr`;
            if (snippets[tagAttrKey] && snippets[tagAttrKey]["class"]) this.filteredKeys = Object.keys(snippets[tagAttrKey]["class"]);
            else this.filteredKeys = Object.keys(snippets["inclass"] || {});
        }

        if ((context === "html" || context === "php") && snippets.inSnippets) {
            Object.keys(snippets.inSnippets).forEach(k => snippetSet[k] = "(external)");
        }

        var lineText = editor.document.getLine(cursor.line);
        var textBeforeCursor = lineText.substring(0, cursor.ch);
        var input = parseLine(textBeforeCursor, textBeforeCursor.length, context);

        if (!input && context !== "inclass") return false;

        this.filteredKeys = Object.keys(snippetSet).filter(k => k.startsWith(input));
        return this.filteredKeys.length > 0;
    };

    MADHINTS.prototype.getHints = function() {
        var cursor = this.editor.getCursorPos();
        var lineText = this.editor.document.getLine(cursor.line);
        var textBeforeCursor = lineText.substring(0, cursor.ch);
        var context = getContext(this.editor);
        if (context === "no-snippets") return { hints: [], match: "", selectInitial: false, handleWideResults: false };

        var snippetSet;
        if (context === "css") snippetSet = flattenSnippets(snippets.css || {});
        else if (context === "javascript") snippetSet = flattenSnippets(snippets.js || {});
        else snippetSet = flattenSnippets(snippets[context] || {});

        var tag = getCurrentTag(this.editor);
        if (context === "tagattr" && tag && snippets[tag + "-tagattr"]) {
            for (let key in snippets[tag + "-tagattr"]) if (key !== "class") snippetSet[key] = snippets[tag + "-tagattr"][key];
        }

        if (context === "inclass") {
            const tagAttrKey = `${tag}-tagattr`;
            if (snippets[tagAttrKey] && snippets[tagAttrKey]["class"]) this.filteredKeys = Object.keys(snippets[tagAttrKey]["class"]);
            else this.filteredKeys = Object.keys(snippets["inclass"] || {});
        }

        if ((context === "html" || context === "php") && snippets.inSnippets) {
            Object.keys(snippets.inSnippets).forEach(k => snippetSet[k] = "(external)");
        }

        var input = parseLine(textBeforeCursor, textBeforeCursor.length, context);
        var hints = this.filteredKeys.filter(k => k.startsWith(input));
        return { hints: hints, match: input, selectInitial: true, handleWideResults: false };
    };

    MADHINTS.prototype.insertHint = function(hint) {
        var cursor = this.editor.getCursorPos();
        var lineText = this.editor.document.getLine(cursor.line);
        var textBeforeCursor = lineText.substring(0, cursor.ch);
        var context = getContext(this.editor);
        if (context === "no-snippets") return false;

        var snippetSet;
        if (context === "css") snippetSet = flattenSnippets(snippets.css || {});
        else if (context === "javascript") snippetSet = flattenSnippets(snippets.js || {});
        else snippetSet = flattenSnippets(snippets[context] || {});

        var tag = getCurrentTag(this.editor);
        if (context === "tagattr" && tag && snippets[tag + "-tagattr"]) {
            for (let key in snippets[tag + "-tagattr"]) if (key !== "class") snippetSet[key] = snippets[tag + "-tagattr"][key];
        }

        if (context === "inclass" && tag) {
            const tagAttrKey = `${tag}-tagattr`;
            if (snippets[tagAttrKey] && snippets[tagAttrKey]["class"]) {
                const classSnippets = snippets[tagAttrKey]["class"];
                for (let key in classSnippets) snippetSet[key] = classSnippets[key];
            }
            if (snippets["inclass"]) Object.assign(snippetSet, flattenSnippets(snippets["inclass"]));
        }

        if (snippetSet[hint]) {
            var snippetText = snippetSet[hint];
            var focusIndex = snippetText.indexOf("#focus");
            var cleanSnippet = snippetText.replace("#focus", "");

            var match = textBeforeCursor.match(/([a-zA-Z0-9_\/:-]+)$/);
            var replaceStart = { line: cursor.line, ch: match ? match.index : cursor.ch };

            this.editor.document.replaceRange(cleanSnippet, replaceStart, cursor);
            if (focusIndex !== -1) {
                var focusPos = { line: replaceStart.line, ch: replaceStart.ch + focusIndex };
                this.editor.setCursorPos(focusPos);
            }
            return false;
        }

        if ((context === "html" || context === "php") && snippets.inSnippets && snippets.inSnippets[hint]) {
            var match2 = textBeforeCursor.match(/([a-zA-Z0-9_\/:-]+)$/);
            var replaceStart2 = { line: cursor.line, ch: match2 ? match2.index : cursor.ch };
            tryLoadExternalSnippet(hint, function (content) {
                if (!content) return;
                EditorManager.getActiveEditor().document.replaceRange("", replaceStart2, cursor);
                insertSnippetText(EditorManager.getActiveEditor(), content, replaceStart2, 0);
            });
            return false;
        }

        return false;
    };

function buildSnippetList() {
    var editor = EditorManager.getActiveEditor();
    if (!editor) return;

    var context = getContext(editor);
    var flat = {};

    // pick snippets based on context
    if (context === "css") flat = flattenSnippets(snippets.css || {});
    else if (context === "javascript") flat = flattenSnippets(snippets.js || {});
    else if (context === "inclass") {
        const tag = getCurrentTag(editor);
        const tagAttrKey = tag ? `${tag}-tagattr` : null;
        if (tagAttrKey && snippets[tagAttrKey] && snippets[tagAttrKey]["class"])
            flat = snippets[tagAttrKey]["class"];
        else flat = flattenSnippets(snippets.inclass || {});
    }
    else if (context === "inattr" || context === "tagattr") {
        const tag = getCurrentTag(editor);
        if (tag && snippets[tag + "-tagattr"]) {
            flat = Object.assign({}, snippets[tag + "-tagattr"]);
            delete flat.class;
        }
    }
    else if (context === "phpinside") flat = flattenSnippets(snippets.phpinside || {});
    else if (context === "php") flat = flattenSnippets(snippets.php || {});
    else if (context === "html") {
        flat = flattenSnippets(snippets.html || {});

        // include external html/php snippets
        if (snippets.inSnippets) {
            Object.keys(snippets.inSnippets).forEach(k => {
                flat[k] = "(external)";
            });
        }

        // include global snippets
        if (snippets.global) Object.assign(flat, flattenSnippets(snippets.global));
    }

    // --- search filter ---
    var searchVal = $("#mad-snippet-search").val().toLowerCase();
    var html = "";
    Object.keys(flat).forEach(function(key){
        if (!searchVal || key.toLowerCase().includes(searchVal)) {
            html += '<div class="mad-snippet-item" data-key="' + key + '">' + key + '</div>';
        }
    });

    $("#mad-snippet-panel .mad-panel-body").html(html);
}






    // --- App init ---
    AppInit.appReady(function () {

    // --- panel container ---
	var panelHtml =
		'<div id="mad-snippet-panel" class="mad-panel">' +
		'  	<div class="mad-panel-header">' +
		'     	<div class="panel-title"><img src="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAh5JREFUOE+t009Ik2EcwPHv+77jXTrYltaYKbP8G9ND082D0cGgwzoYeK6DUBEdOkUQFEk1COnvwVuQGJ0kIoK6ePRdiRLqkmGzaWnZ3IZsa9P9e9/YUmMktUPP5XkOv9+H5/f7PY/Ar2UCnFvncrcJ4IewFd3d4j6nGCy2spLjXwN8GhtpB+Z2AOfZQcVcby8LiHycYvrpwP8DdMCV6uZOT4XZAqKEKEmIOplalxstn+P75Gv2x1YRMxukRR3L6QzhxQ+XgKFCCZ3AZNeFB0I+mybsf4el7SiaqvL+yVVE4L7LxWoqRSAep1qvJ5nL8SwY1IDW7R7c7Lk2en3+zWNs3b0sv33F4d6LfHvYj4yGp6OD2zMznGlsZDwUQi9JDC8sXAbubQN9rvN3n3/xviQ0N07NkePUudz0eIdJ5fPYTSYe+f0EYjH66utpMhq54/OdAMZ2plB7qE3RHWjhs/KCuq6TVIUXuXHQSk7TGPL7SasqE+Ew/U1NTEWj+NbXS6dwy+FQEtkssWwWa0UFjqoqdGKhA5Ap9CMaJby5yV5ZRhIEPLOzpcCg06nYzea/voMCsJJMktc0Bqan/wREQSCrqjQbjeyRpCKWyuWYj8Xwrq0Vb3TKZisiuwI1lZWMBAIsJpOomoYsiphkmXazmWNWK/v0+iI6FYnsDvyrhO36dgVONzQotQZDWX8hmEgwurRU0oNCZmtZ2b+D/MDGT8vB5DggBrzFAAAAAElFTkSuQmCC">'+
		'			<span>Mad Snippets</span>' +
		'		</div>' +
		'		<input type="text" id="mad-snippet-search" placeholder="Search..." autocomplete="off"/>' +
		'   </div>' +
		'  	<div class="mad-panel-body"></div>' +
		'</div>';
	$("body").append(panelHtml);

	var panelpreview = '<div id="mad-snippet-preview"></div>';
	$("body").append(panelpreview);
	
$(document).on("mouseenter", ".mad-snippet-item", function(e){
    var key = $(this).data("key");
    var flat = {};
    var editor = EditorManager.getActiveEditor();
    if (!editor) return;

    var context = getContext(editor);

    // Build snippet set same as buildSnippetList()
    if (context === "css") flat = flattenSnippets(snippets.css || {});
    else if (context === "javascript") flat = flattenSnippets(snippets.js || {});
    else if (context === "inclass") {
        const tag = getCurrentTag(editor);
        const tagAttrKey = tag ? `${tag}-tagattr` : null;
        if (tagAttrKey && snippets[tagAttrKey] && snippets[tagAttrKey]["class"])
            flat = snippets[tagAttrKey]["class"];
        else flat = flattenSnippets(snippets.inclass || {});
    }
    else if (context === "inattr" || context === "tagattr") {
        const tag = getCurrentTag(editor);
        if (tag && snippets[tag + "-tagattr"]) {
            flat = Object.assign({}, snippets[tag + "-tagattr"]);
            delete flat.class;
        }
    }
    else if (context === "phpinside") flat = flattenSnippets(snippets.phpinside || {});
    else if (context === "php") flat = flattenSnippets(snippets.php || {});
    else if (context === "html") {
        flat = flattenSnippets(snippets.html || {});
        if (snippets.global) Object.assign(flat, flattenSnippets(snippets.global));

        // external preview
        if (snippets.inSnippets && snippets.inSnippets[key]) {
            tryLoadExternalSnippet(key, function(content){
                $("#mad-snippet-preview").text(content || "No preview");
            });
        }
    }

    // internal snippet preview
    if (flat[key] && flat[key] !== "(external)") {
        $("#mad-snippet-preview").text(flat[key].replace("#focus", ""));
    }

    $("#mad-snippet-preview").css({ top: e.pageY + 10, left: e.pageX + 10 }).show();
});

	$(document).on("mousemove", ".mad-snippet-item", function(e){
		$("#mad-snippet-preview").css({ top: e.pageY + 10, left: e.pageX + 10 });
	});

	$(document).on("mouseleave", ".mad-snippet-item", function(){
		$("#mad-snippet-preview").hide().text("");
	});
	
	
    // --- toolbar button ---
    var buttonHtml =
        '<a id="mad-snippets-btn" href="#" title="Mad Snippets" class="toolbar-button">' +
        '   <span class="fa fa-code"></span>' +
        '</a>';

    $("#main-toolbar .buttons").append(buttonHtml);

    // --- panel toggle ---
	$(document).on("click", "#mad-snippets-btn", function (e) {
		e.preventDefault();
		var panel = $("#mad-snippet-panel");
		if (!panel.hasClass("active")) {
			buildSnippetList(); // populate panel only when opening
		}
		panel.toggleClass("active");
	});

	
    // --- search filter ---
    $(document).on("input", "#mad-snippet-search", buildSnippetList);	

    // --- snippet click ---
	$(document).on("click", ".mad-snippet-item", function () {
		var key = $(this).data("key");
		var editor = EditorManager.getActiveEditor();
		if (!editor) return;

		var cursor = editor.getCursorPos();
		var snippetText;

		// --- flatten all snippets into one object ---
		var flatSnippets = {};
		Object.keys(snippets).forEach(function(ctx){
			if (typeof snippets[ctx] === "object") {
				Object.assign(flatSnippets, flattenSnippets(snippets[ctx]));
			}
		});

		// check flattened snippets first
		if (flatSnippets[key]) {
			snippetText = flatSnippets[key];
			editor.document.replaceRange(snippetText.replace("#focus",""), cursor);
			// $("#mad-snippet-panel").hide();
			return;
		}

		// check external snippets
		if (snippets.inSnippets && snippets.inSnippets[key]) {
			tryLoadExternalSnippet(key, function(content){
				if (!content) return;
				insertSnippetText(editor, content, cursor, 0);
				// $("#mad-snippet-panel").hide();
			});
			return;
		}
	});

		// --- update panel dynamically when editor or cursor changes ---
		$(EditorManager).on('activeEditorChange', function () {
			buildSnippetList();
		});
		$(document).on('keyup click', '.CodeMirror-scroll', function () {
			if ($("#mad-snippet-panel").is(":visible")) buildSnippetList();
		});

		// Original code
		
        CommandManager.register(COMMAND_NAME, COMMAND_ID, function () {
            enabled = !enabled;
            prefs.set('enabled', enabled);
            prefs.save();
            CommandManager.get(COMMAND_ID).setChecked(enabled);
        });
        Menus.getMenu(Menus.AppMenuBar.EDIT_MENU).addMenuItem(COMMAND_ID);

        var currentEditor = EditorManager.getCurrentFullEditor();
        if (currentEditor) {
            $(currentEditor).on('keyEvent', keyEventHandler);
            $(currentEditor).on('keydown', enterHandler);
        }
        $(EditorManager).on('activeEditorChange', activeEditorChangeHandler);

        var jadHints = new MADHINTS();
        CodeHintManager.registerHintProvider(jadHints, ["html","css","javascript","php","inclass","tagattr","inattr"], 10);

        prefs.on('change', function () {
            enabled = prefs.get('enabled');
            CommandManager.get(COMMAND_ID).setChecked(enabled);
        });
    });

});
