# Console
The console collects console output from from all parts of the system. You can filter its output by origin and by severity level.

Origins:
- Processor: Logs from the maximilian processor.
- Main: Logs from the main thread.
- Learner: Logs from the javascript window. For example any logs you might produce from you machine learning model will be collected here.

Severity Levels.
- log: output from `console.log`.
- info: output from `console.info`.
- warns: output from `console.warn`.
- error: output from `console.error`.

# Live Code Parser
The _Live Code Parser_ provides feedback on your custom-language compilation. It will show errors if your language has a syntax error.

Otherwise it shows the Abstract Syntax Tree (AST) that results from parsing your live code. You can unfold the branches by click on them.

# DSP Code
The _DSP Code_ widget shows the code that Sema generates (Maximilian DSP JavaScript) when you evaluate your live code.

This DSP code is injected into and runs in the Sema audio engine.

# Grammar Compiler
The _Grammar Compiler_ provides feedback on the compilation of the grammar and parser generation for your custom-language.

It will give compilation errors if your grammar specification has a syntax error or ill-defined rules.

Otherwise, it displays a message saying: "grammar was validated and the parser was generated".