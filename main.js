/*
The MIT License (MIT)

Copyright (c) 2015 HTML5andBeyond.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
define(function (require, exports, module) {
    'use strict';

    var AppInit           = brackets.getModule('utils/AppInit'),
        EditorManager     = brackets.getModule('editor/EditorManager'),
        CodeHintManager   = brackets.getModule("editor/CodeHintManager"),
        PreferencesManager= brackets.getModule('preferences/PreferencesManager'),
        Menus             = brackets.getModule('command/Menus'),
        CommandManager    = brackets.getModule('command/CommandManager'),
        KeyEvent          = brackets.getModule('utils/KeyEvent'),

        snippets          = require('snippet'), 
        enabled           = true,
        prefs             = PreferencesManager.getExtensionPrefs('mad-snippets'),

        COMMAND_NAME      = 'Enable Mad Snippets',
        COMMAND_ID        = 'madapbox.toggleMADSnippets';

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

    function getContext(editor) {
        var filePath = editor.document.file.fullPath;
        var fileExt = filePath.split('.').pop().toLowerCase();
        var cursor = editor.getCursorPos();
        var textBeforeCursor = editor.document.getRange({ line: 0, ch: 0 }, cursor);

        if (fileExt === "php") {
            var phpOpenTags = [...textBeforeCursor.matchAll(/<\?php/gi)].map(m => m.index);
            var phpCloseTags = [...textBeforeCursor.matchAll(/\?>/gi)].map(m => m.index);
            if (phpOpenTags.length > 0) {
                var lastOpen = phpOpenTags[phpOpenTags.length - 1];
                var lastClose = phpCloseTags.length > 0 ? phpCloseTags[phpCloseTags.length - 1] : -1;
                if (lastOpen > lastClose) return "php";
            }
        }

        var styleMatches = [...textBeforeCursor.matchAll(/<style[^>]*>/gi)];
        var styleEndMatches = [...textBeforeCursor.matchAll(/<\/style>/gi)];
        if (styleMatches.length > styleEndMatches.length) return "css";

        var scriptMatches = [...textBeforeCursor.matchAll(/<script[^>]*>/gi)];
        var scriptEndMatches = [...textBeforeCursor.matchAll(/<\/script>/gi)];
        if (scriptMatches.length > scriptEndMatches.length) return "javascript";

        if (fileExt === "html" || fileExt === "php") {
            var lineText = editor.document.getLine(cursor.line);
            var textUpToCursor = lineText.substring(0, cursor.ch);

            let attrMatch = textUpToCursor.match(/([a-zA-Z-]+)\s*=\s*"([^"]*)$/);
            if (attrMatch) {
                let attrName = attrMatch[1].toLowerCase();
                if (attrName === "class") {
                    return "inclass";
                } else {
                    return "no-snippets"; 
                }
            }
        }

        if (fileExt === "css") return "css";
        if (fileExt === "js") return "javascript";
        if (fileExt === "php") return "html";
        return "html";
    }

    function parseLine(line, cursorPosition, context) {
        line = line.substring(0, cursorPosition);

        if (context === "inclass") {
            var match = line.match(/([\w-]+)$/);
            return match ? match[1] : "";
        } else {
            var match = line.match(/([a-zA-Z][a-zA-Z0-9_-]*)$/);
            return match ? match[0] : "";
        }
    }

    function expandSnippet(editor, snippetKey, cursorPosition, line) {
        var context = getContext(editor);
        if (context === "no-snippets") return false;

        var snippetSet = flattenSnippets(snippets[context] || {});
        if (!snippetSet[snippetKey]) return false;

        var startCh = cursorPosition.ch - snippetKey.length;
        var start = { line: cursorPosition.line, ch: startCh };
        var snippetText = snippetSet[snippetKey];

        var focusIndex = snippetText.indexOf("#focus");
        var cleanSnippet = snippetText.replace("#focus", "");

        editor.document.replaceRange(cleanSnippet, start, cursorPosition);

        if (focusIndex !== -1) {
            var focusPos = { line: start.line, ch: start.ch + focusIndex };
            editor.setCursorPos(focusPos);
        }
        return true;
    }

    function keyEventHandler($event, editor, event) {
        enabled = prefs.get('enabled');
        if (!enabled) return;

        if (event.type === 'keydown' && event.keyCode === KeyEvent.DOM_VK_TAB) {
            var cursorPosition = editor.getCursorPos();
            var line = editor.document.getLine(cursorPosition.line);
            var snippetKey = parseLine(line, cursorPosition.ch, getContext(editor));

            if (expandSnippet(editor, snippetKey, cursorPosition, line)) {
                event.preventDefault();
            }
        }
    }

    function enterHandler(event) {
        if (event.keyCode !== KeyEvent.DOM_VK_RETURN) return;

        var editor = EditorManager.getActiveEditor();
        if (!editor) return;

        var cursorPosition = editor.getCursorPos();
        var line = editor.document.getLine(cursorPosition.line);
        var snippetKey = parseLine(line, cursorPosition.ch, getContext(editor));

        if (expandSnippet(editor, snippetKey, cursorPosition, line)) {
            event.preventDefault();
        }
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

    function MADhints() {
        this.editor = null;
        this.filteredKeys = [];
        this.currentTokenDefinition = /[a-zA-Z][a-zA-Z0-9_-]*$/;
    }
    MADhints.prototype.hasHints = function(editor) {
        this.editor = editor;
        var cursor = editor.getCursorPos();
        var context = getContext(editor);
        if (context === "no-snippets") return false;

        var snippetSet = flattenSnippets(snippets[context] || {});
        var lineText = editor.document.getLine(cursor.line);
        var textBeforeCursor = lineText.substring(0, cursor.ch);
        var input = parseLine(textBeforeCursor, textBeforeCursor.length, context);

        if (!input && context !== "inclass") return false;
        this.filteredKeys = Object.keys(snippetSet).filter(k => k.startsWith(input));
        return this.filteredKeys.length > 0;
    };
    MADhints.prototype.getHints = function() {
        var cursor = this.editor.getCursorPos();
        var lineText = this.editor.document.getLine(cursor.line);
        var textBeforeCursor = lineText.substring(0, cursor.ch);
        var context = getContext(this.editor);
        if (context === "no-snippets") return { hints: [], match: "", selectInitial: false, handleWideResults: false };

        var snippetSet = flattenSnippets(snippets[context] || {});
        var input = parseLine(textBeforeCursor, textBeforeCursor.length, context);

        var hints = this.filteredKeys.filter(k => k.startsWith(input));
        return {
            hints: hints,
            match: input,
            selectInitial: true,
            handleWideResults: false
        };
    };
    MADhints.prototype.insertHint = function(hint) {
        var cursor = this.editor.getCursorPos();
        var lineText = this.editor.document.getLine(cursor.line);
        var textBeforeCursor = lineText.substring(0, cursor.ch);

        var context = getContext(this.editor);
        if (context === "no-snippets") return false;

        var snippetSet = flattenSnippets(snippets[context] || {});
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
    };

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

        var jadHints = new MADhints();
        CodeHintManager.registerHintProvider(jadHints, ["html","css","javascript","php","inclass"], 10);

        prefs.on('change', function () {
            enabled = prefs.get('enabled');
            CommandManager.get(COMMAND_ID).setChecked(enabled);
        });
    });
});