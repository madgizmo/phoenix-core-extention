/* global define */
define(function (require, exports, module) {
    'use strict';
    var FileSystem = brackets.getModule("filesystem/FileSystem");

    var external = {
        map: {},

        // register which snippet keys exist externally
        register: function (keys) {
            keys.forEach(k => external.map[k] = true);
        },

        // check if a snippet key is external
        exists: function (key) {
            return !!external.map[key];
        },
        // async load from /snippets folder
        load: function (key, callback) {
            if (!external.exists(key)) {
                callback(null);
                return;
            }

            var file = FileSystem.getFileForPath("snippets/" + key + ".html");
            file.read(function (err, content) {
                if (err) {
                    console.error("Snippet read error:", key, err);
                    callback(null);
                } else {
                    callback(content);
                }
            });
        }
    };

    module.exports = external;
});
