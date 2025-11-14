define(function () {
    return {
	"document-ready": "document.addEventListener(\"DOMContentLoaded\", function() {\n #focus\n});\n",
	"form-select": "\ndocument.querySelectorAll('select').forEach((select) => {\n    // Example: on change\n    select.addEventListener('change', (event) => {\n        console.log('Selected value:', event.target.value);\n    });\n\n    // Example: on focus (hover alternative)\n    select.addEventListener('focus', () => {\n        console.log('Select focused');\n    });\n});\n",
	"function": "function functionName() {};",
    // Event listeners
    "on-click": "element.addEventListener('click', () => {\n\n});",
    "on-change": "element.addEventListener('change', (e) => {\n    const value = e.target.value;\n});",
    "on-input": "element.addEventListener('input', (e) => {\n    const value = e.target.value;\n});",
    "on-hover": "element.addEventListener('mouseover', () => {\n\n});",
    "on-mouseout": "element.addEventListener('mouseout', () => {\n\n});",
    
    // DOM manipulation
    "create-element": "const div = document.createElement('div');\ndiv.classList.add('class');\ndiv.textContent = 'Text';\nparent.appendChild(div);",
    "remove-element": "element.remove();",
    "append-child": "parent.appendChild(child);",
    "prepend-child": "parent.prepend(child);",
    "insert-before": "parent.insertBefore(newNode, referenceNode);",
    
    // Traversing
    "get-children": "const children = parent.children;",
    "get-parent": "const parent = element.parentElement;",
    "get-next-sibling": "const next = element.nextElementSibling;",
    "get-previous-sibling": "const prev = element.previousElementSibling;",
    
    // Forms
    "get-value": "const value = input.value;",
    "set-value": "input.value = 'newValue';",
    "check-checked": "const checked = checkbox.checked;",
    "set-checked": "checkbox.checked = true;",
    
    // Loops & iterations
    "for-loop": "for(let i = 0; i < array.length; i++) {\n    const item = array[i];\n}",
    "for-of-loop": "for(const item of array) {\n    // use item\n}",
    "for-in-loop": "for(const key in object) {\n    if(object.hasOwnProperty(key)) {\n        const value = object[key];\n    }\n}",
    "forEach-array": "array.forEach(item => {\n    // do something\n});",
    
    // Fetch / AJAX
    "fetch-get": "fetch(url)\n    .then(response => response.json())\n    .then(data => {\n        console.log(data);\n    });",
    "fetch-post": "fetch(url, {\n    method: 'POST',\n    headers: {'Content-Type': 'application/json'},\n    body: JSON.stringify({key: 'value'})\n}).then(res => res.json()).then(data => console.log(data));",
    
    // Timeout / Interval
    "set-timeout": "setTimeout(() => {\n    // do something\n}, 1000);",
    "set-interval": "setInterval(() => {\n    // repeat something\n}, 1000);",
    
    // Console / debugging
    "console-log": "console.log('Debug info:', variable);",
    "console-table": "console.table(array);",
    "console-error": "console.error('Error:', error);",
    
    // Classes
    "add-class": "element.classList.add('class');",
    "remove-class": "element.classList.remove('class');",
    "toggle-class": "element.classList.toggle('class');",
    
    // Storage
    "local-set": "localStorage.setItem('key', 'value');",
    "local-get": "const value = localStorage.getItem('key');",
    "local-remove": "localStorage.removeItem('key');",
    
    // Template literals
    "template-literal": "const html = `<div class='class'>${variable}</div>`;",
	
	"form": {	
		// Inputs
		"get-input-value": "const value = input.value;",
		"set-input-value": "input.value = 'new value';",
		"clear-input": "input.value = '';",
		// Textareas
		"get-textarea-value": "const text = textarea.value;",
		"set-textarea-value": "textarea.value = 'new text';",
		// Checkboxes
		"is-checked": "const checked = checkbox.checked;",
		"check-checkbox": "checkbox.checked = true;",
		"uncheck-checkbox": "checkbox.checked = false;",
		"toggle-checkbox": "checkbox.checked = !checkbox.checked;",
		// Radio buttons
		"get-radio-value": "const selected = document.querySelector('input[name=\"group\"]:checked').value;",
		"set-radio-value": "document.querySelector('input[name=\"group\"][value=\"val\"]').checked = true;",
		// Selects
		"get-select-value": "const value = select.value;",
		"set-select-value": "select.value = 'optionValue';",
		"get-selected-index": "const index = select.selectedIndex;",
		"set-selected-index": "select.selectedIndex = 0;",
		// Form submission
		"submit-form": "form.submit();",
		"prevent-form-submit": "form.addEventListener('submit', e => {\n    e.preventDefault();\n});",
		// Form reset
		"reset-form": "form.reset();",
		// Iterate over form elements
		"loop-form-elements": "Array.from(form.elements).forEach(el => {\n    console.log(el.name, el.value);\n});",
		// Form validation check
		"check-validity": "if(form.checkValidity()) {\n    // form is valid\n} else {\n    // form is invalid\n}",
		// Enable / disable elements
		"disable-element": "element.disabled = true;",
		"enable-element": "element.disabled = false;",
	},
	"time": {
		// Current date and time
		"current-date": "const now = new Date();",
		"current-timestamp": "const timestamp = Date.now();",
		// Date parts
		"get-year": "const year = now.getFullYear();",
		"get-month": "const month = now.getMonth() + 1; // 0-11",
		"get-day": "const day = now.getDate();",
		"get-weekday": "const weekday = now.getDay(); // 0=Sun, 6=Sat",
		"get-hours": "const hours = now.getHours();",
		"get-minutes": "const minutes = now.getMinutes();",
		"get-seconds": "const seconds = now.getSeconds();",
		"get-ms": "const milliseconds = now.getMilliseconds();",
		// Set date parts
		"set-year": "now.setFullYear(2025);",
		"set-month": "now.setMonth(8); // September",
		"set-day": "now.setDate(26);",
		"set-hours": "now.setHours(18);",
		"set-minutes": "now.setMinutes(30);",
		"set-seconds": "now.setSeconds(0);",
		// Format date
		"iso-string": "const iso = now.toISOString();",
		"locale-string": "const local = now.toLocaleString();",
		"locale-date": "const localDate = now.toLocaleDateString();",
		"locale-time": "const localTime = now.toLocaleTimeString();",
		// Timestamps
		"from-timestamp": "const date = new Date(1670000000000);",
		"to-timestamp": "const timestamp = now.getTime();",
		// Date math
		"add-days": "const future = new Date();\nfuture.setDate(future.getDate() + 7); // 7 days later",
		"subtract-days": "const past = new Date();\npast.setDate(past.getDate() - 7); // 7 days ago",
		"diff-days": "const diff = Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));",
		// Timers
		"start-timer": "const start = Date.now();",
		"end-timer": "const end = Date.now();\nconst elapsed = end - start; // in ms",
		// Formatting helper
		"pad-zero": "const str = String(number).padStart(2, '0'); // e.g., 07",
		// Example full datetime string
		"formatted-datetime": "const formatted = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;"
	}	
};
});
