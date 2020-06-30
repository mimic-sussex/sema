# Other Widgets

There are other types of widgets that co-exist with the editors on Sema's dashboard. They provide visualization and feedback on the live coding and language design workflows. 

This tutorial introduces the basics of these widgets and their interplay. We will be looking in more detail to the last three widgets in Part 4.

## Audio Analyser

The *Audio Analyser* provides visualizations that can help you understand the signal that your live code is generating. It has three modes: 
* Oscilloscope
* Spectrogram
* Oscilloscope and Spectrogram overlaid

## Grammar Compiler Output

The *Grammar Compiler* provides feedback on the compilation of the grammar and parser generation for your custom-language. 

It will give compilation errors if your grammar specification has a syntax error or ill-defined rules.

Otherwise, it displays a message saying: "grammar was validated and the parser was generated".

## Live Code Parser Output

The *Live Code Parser Output* provides feedback on your custom-language compilation. It will give parsing errors if your language has a syntax error. 

Otherwise it shows the Abstract Syntax Tree (AST) that results from parsing your live code. You can unfold the AST branches by click on them.

## DSP Code Output 

The *DSP Code Output* widget shows the code that Sema generates (Maximilian DSP JavaScript) when you evaluate your live code. 

This DSP code is injected into and runs in the Sema audio engine.  

<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->