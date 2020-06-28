# Introduction to Language Design
 
In this part of the tutorial, we are going develop some knowledge about the language design workflow in Sema.

For that, we will be focusing on the *Grammar Editor* and: 

* how it interacts with the *Live Coding Editor* and the debugging widgets, and how use these to test out our custom language as we go.

* the notation that it accepts and the structure of this notation.

* understand how to tweak an existing language and to create a new one. 

Creating a new language is no small task! It requires design, philosophy and logic. However, it ranges from modifying existing language (for example by changing its syntax) to actually creating a brand new language. For this work we need to understand a few key features of Sema and its language design concepts:

## Interaction(s) of Grammar Editor

This editor is *context-dependent* and bound to the language of the LiveCode editor. So give focus to you LiveCode editor to show the button to create the grammar Editor.


## Lexical Analysis

## Syntax Analysis

The *Grammar Compiler Output* provides feedback on the compilation of the grammar and parser generation for your custom-language. 

It will give compilation errors if your grammar: 
 
1. has a syntax error specification
2. the rules are ill-defined
3. is ambiguous

Otherwise, it shows that the "grammar was validated and the parser was generated".



The *Live Code Parser Output* provides feedback on your custom-language compilation. It will give parsing errors if your language has a syntax error. 

Otherwise it shows the Abstract Syntax Tree (AST) that results from parsing your live code. You can unfold the AST branches by click on them.

## DSP Code Output 

The *DSP Code Output* widget shows the code which Sema generates (Maximilian DSP JavaScript) when you evaluate your live code. 

This DSP code is injected into and runs in the Sema audio engine.  

## *The exercise* 

There is an error preventing the language to be compiled. What do you need change?

<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->