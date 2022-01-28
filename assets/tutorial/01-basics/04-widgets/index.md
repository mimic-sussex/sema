# Other Widgets

There are other types of widgets that co-exist with the editors on Sema's dashboard. They provide visualization and feedback on the live coding and language design workflows.

This tutorial introduces the basics of these widgets and their interplay. We will be looking in more detail to the last three widgets in Part 4.

## Audio Analyser

The *Audio Analyser* provides visualizations that can help you understand the signal that your live code is generating. It has three modes:
* Oscilloscope
* Spectrogram
* Oscilloscope and Spectrogram overlaid

## Grammar Compiler

The *Grammar Compiler* provides feedback on the compilation of the grammar and parser generation for your custom-language.

It will give compilation errors if your grammar specification has a syntax error or ill-defined rules.

Otherwise, it displays a message saying: "grammar was validated and the parser was generated".

## Live Code Parser

The *Live Code Parser* provides feedback on your custom-language compilation. It will show errors if your language has a syntax error.

Otherwise it shows the Abstract Syntax Tree (AST) that results from parsing your live code. You can unfold the branches by click on them.

## DSP Code

The *DSP Code* widget shows the code that Sema generates (Maximilian DSP JavaScript) when you evaluate your live code.

This DSP code is injected into and runs in the Sema audio engine.

## Console
The *Console* collects console output from from all parts of the system. You can fine tune the output of the console by filtering either by origin or severity level using the toggle buttons at the top of the widget. All are enabled by default.

### Origins:
- Processor: Logs from the maximilian processor.
- Main: Logs from the main thread.
- Learner: Logs from the javascript window. For example any logs you might produce from you machine learning model will be collected here.

### Severity Levels
- log: output from `console.log`.
- info: output from `console.info`.
- warns: output from `console.warn`.
- error: output from `console.error`.



<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->