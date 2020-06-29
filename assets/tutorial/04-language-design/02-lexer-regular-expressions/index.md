# Other widgets

As you will see when you start to work in the Playground, there are other types of widgets that co-exist with the editors on Sema's dashboard. They provide visualization and feedback on the live coding and language design workflows. 

This tutorial introduces the basics of these widgets. It also provides a simple exercise for you to understand their interplay. 

## Audio Analyser

The *Audio Analyser* provides visualizations that can help you understand the signal that your live code is generating. It has three modes: 
* Oscilloscope
* Spectrogram
* Oscilloscope and Spectrogram overlaid

## Grammar Compiler Output

The *Grammar Compiler* provides feedback on the compilation of the grammar and parser generation for your custom-language. 

It will give compilation errors if your grammar: 
 
1. has a syntax error specification
2. the rules are ill-defined
3. is ambiguous

Otherwise, it shows that the "grammar was validated and the parser was generated".

## Live Code Parser Output

The *Live Code Parser Output* provides feedback on your custom-language compilation. It will give parsing errors if your language has a syntax error. 

Otherwise it shows the Abstract Syntax Tree (AST) that results from parsing your live code. You can unfold the AST branches by click on them.

## DSP Code Output 

The *DSP Code Output* widget shows the code which Sema generates (Maximilian DSP Javascript) when you evaluate your live code. 

This DSP code is injected into and runs in the Sema audio engine.  

## *The exercise* 

There is an error preventing the live coding to be evaluated. What do you need change?

<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->