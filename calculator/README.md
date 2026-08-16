# Calculator — Land Surveying Pro

This folder contains a small calculator app added to the repository. It provides:

- A safe expression parser based on the shunting-yard algorithm and RPN evaluation (no use of eval or Function).
- Memory operations (MC, MR, M+, M-).
- Extra functions: sqrt, pow (^), sin, cos, percent (%), parentheses.
- Keyboard support and a responsive UI.

How to run

1. Open `calculator/index.html` in a browser (double-click or serve the repo).
2. Use buttons or keyboard to enter expressions and press `=` or Enter to compute.

Notes & security

- The parser accepts numbers, operators (+ - * / ^), parentheses, percent token (treated as /100), and function names (sqrt, sin, cos, tan, ln, abs).
- Input is sanitized before evaluation; arbitrary JS cannot be executed via the calculator.

If you want more functions (degrees/radians switch, factorial, log10, or survey-specific calculations like offsets and coordinate transforms) I can add them next.
