# How to use the Grammar editor

The grammar editor is launched from the sidebar under 'Widget settings' when a live-code editor is selected. This launches the grammar editor for the loaded language.

When editing the content in the Grammar Editor, you don't need to hit cmd-Enter/ctrl-Enter to evaluate changes. Rather, this editor does continuous evaluation, which means that on every keystroke, every change, a new parser is generated and immediately applied to analyse the content of the LiveCode Editor.

If the grammar specification is correct, the **Grammar Compiler Output** widget will show "Grammar validated and the parser generated!" in green.

However, it will give compilation errors if your grammar specification:
 - has a syntax error
 - has ill-defined rules
 - is ambiguous
