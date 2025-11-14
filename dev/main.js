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

    // --- App init ---
    AppInit.appReady(function () {
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
