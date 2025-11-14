define(function (require) {
    var snippetsGlobal 		= require('jssnippets/snippets-global');
    var snippetsCss    		= require('jssnippets/snippets-css');
    var snippetsPhp    		= require('jssnippets/snippets-php-top');
	var snippetsPhpInside   = require('jssnippets/snippets-php');
    var snippetsIsInClass     = require('jssnippets/snippets-inclass');
	var snippetsJs     		= require('jssnippets/snippets-js');
	var snippetsHtml     		= require('jssnippets/snippets-html');

    function merge(a, b) {
        for (var k in b) {
            if (typeof b[k] === "object" && !Array.isArray(b[k])) {
                a[k] = merge(a[k] || {}, b[k]);
            } else {
                a[k] = b[k];
            }
        }
        return a;
    }

    var snippets = {
        js: {},
        html: {},
        css: {},
        php: {},
		phpinside: {},
        tagattr: { "id":"id=\"#focus\"", "class":"class=\"#focus\""},
		inclass: {},
		version: {
			"version": "<?= time(); ?>",
			"?version": "<?= time(); ?>",
		},	
		"hero-slider-tagattr": { 
			"hero-effect-zoom": "hero-effect=\"zoom\"",
			"hero-timing": "hero-timing=\"#focus\"",
			"hero-overlay": "hero-overlay=\"#focus\"",
			"class": { 
				"dots": "dots",
				"controlls": "controlls"			
			}
		},		
    };

	
    snippets.inSnippets = {
        "hero-slider": true,
        "template-clean": true,
        "template-madframework": true,
        "item-card": true,
        "meta-mobile": true,
        "template-meta": true,
        "navbar-full": true,
        "section": true
    };

    // merge global into all contexts
	snippets.inclass = merge(snippets.inclass, snippetsIsInClass); 
    snippets.js   = merge(snippets.js, snippetsJs);
    snippets.html = merge(snippets.html, snippetsGlobal);
	snippets.html = merge(snippets.html, snippetsHtml);
	
    snippets.css  = merge(snippets.css, snippetsCss);
	snippets.php = merge(snippets.php, snippetsPhp); 
	snippets.phpinside  = merge(snippets.phpinside, snippetsPhpInside);
	

    return snippets;
});