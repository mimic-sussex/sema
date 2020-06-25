# Other widgets

In Sema, there are other types of widgets that co-exist with the editors on the dashboard. They provide visualization and feedback on the live coding and language design process. 

## Audio Analyser

The *Audio Analyser* provides visualizations that can help you understand the signal that your live code is generating. It has three modes: 
* Oscilloscope
* Spectrogram
* Oscilloscope and Spectrogram overlaid

## Grammar Compiler Output

The *Grammar Compiler* provides feedback on the compilation of the grammar and parser generation for your custom-language. It will give compilation errors if your grammar: 
 
1. has a syntax error specification
2. the rules are ill-defined
3. is ambiguous

Otherwise, it shows that the "grammar was validated and the parser was generated".

## Live Code Parser Output

The *Live Code Parser Output* provides feedback on your custom-language compilation. It will give parsing errors if your language has a syntax error. Otherwise it shows the abstract syntax tree that results from parsing your live code.

## DSP Code generated

The *DSP Code generated* widget shows the Maximilian Javascript DSP code which Sema generates when you evaluate of your live code. This DSP is injected into and run in the Sema audio engine.  

<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->