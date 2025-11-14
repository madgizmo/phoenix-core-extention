define(function () {
    return {
		"echo": "echo \"#focus\";\n",
		
		"foreach": "$array = ['apple', 'banana', 'cherry'];\n\
\n\
foreach ($array as $item):\n\
	echo $item . \"<br>\";\n\
endforeach;\n",
		
"if": "if ($number > 10):\n\
	echo \"Greater than 10\";\n\
elseif ($number == 10):\n\
	echo \"Equal to 10\";\n\
else:\n\
	echo \"Less than 10\";\n\
endif;",

"switch": "$action = isset($_POST['action']) ? json_decode($_POST['action'], true) : '';\n\
switch ($action):\n\
	case 'UpdateSettings':\n\n\
	break;\n\n\
	default:\n\n\
	break;\n\n\
endswitch;\n",
					
		
		"case": "case '#focus':\n\nbreak;\n",
		
		"time": {
			"date": "date('d-m-Y');",          // 14-11-2025
			"year": "date('Y');",              // 2025
			"month": "date('m');",             // 11
			"month_name": "date('F');",        // November
			"day": "date('d');",               // 14
			"day_name": "date('l');",          // Friday
			"week_number": "date('W');",       // 46
			"time": "date('H:i:s');",          // 02:15:30
			"hour": "date('H');",              // 02
			"minute": "date('i');",            // 15
			"second": "date('s');",            // 30
			"stamp": "time();",            // 1739620530
			"iso8601": "date('c');",           // 2025-11-14T02:15:30+01:00
			"rfc2822": "date('r');",            // Fri, 14 Nov 2025 02:15:30 +0100
			"short_date": "date('d F Y');",    // 14 November 2025
			"long_date": "date('l d F Y');"    // Friday 14 November 2025
		},
		

		"func": {
			myfunc: "function myFunction($param) {\n    // code\n}\n",
			helper: "function helperFunction() {\n    // code\n}\n"
		}
    };
});
