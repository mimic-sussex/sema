# Introduction to Language Design
 
In this part of the tutorial, we are going develop some knowledge about the language design workflow in Sema.

We will be focusing on the *Grammar Editor*, and more specifically, in: 

* how it can help you customise or create a new language from scratch.

* how it interacts with the *Live Coding Editor* and the debugging widgets, and how to use these to test out our custom language as we go.

* the notation that it accepts and the structure of this notation.

We will finish this section with an exercise, in which you will create a new language from the default language which you have been learning previously, just by changing one element only.

Creating a new language is no small task! It requires design, philosophy and logic. However, it ranges from modifying existing language (for example by changing its syntax) to actually creating a brand new language. 

For this work we need to understand a few key features of Sema and its language design concepts:

## Grammars in a nutshell

If you think back to your language lessons you might remember that a grammar defines the rules of a language. Basically, a grammar says what is what in the elements of a sentence (e.g. a noun, a verb, an adjective) and how they relate.  

The *Grammar Editor* gives you the capability to create and edit a grammar, which specifies how a live language is. The grammar, which is specified in a special notation—or language, i.e. the [Backus Naur Form](http://hardmath123.github.io/earley.html)—is compiled to generate a parser.

A parser is nothing more than a process which breaks down the text that you enter in the *LiveCode Editor* and organises it in a way which makes it easier to understand what the text means. 

The result is a tree-like structure called Abstract Syntax Tree, which keeps the broken-down bits of text organised and labeled, and that you can see in the *Live Code Parser Output*. 

There is a lot that could be said about grammars, parsers and compilers, but you can find a few simple and user-friendly tutorials to start with [here](https://medium.com/@gajus/parsing-absolutely-anything-in-javascript-using-earley-algorithm-886edcc31e5e) and in the link above.


## Grammar Editor Interaction(s)

When editing the content in the *Grammar Editor*, you don't need to hit **cmd-Enter**/**ctrl-Enter** to evaluate changes. Rather, this editor does continuous evaluation, which means that on every keystroke, every change, a new parser is generated and immediately applied to analyse the content of the LiveCode Editor.  

If the grammar specification is correct, the *Grammar Compiler Output* shows that the "grammar was validated and the parser was generated". Otherwise it will give compilation errors if your grammar specification: 
1. has a syntax error 
2. has ill-defined rules
3. is ambiguous

## *A simple exercise* 

There is an error preventing the language to be compiled. What do you need change?



The *Live Code Parser Output* provides feedback on your custom-language compilation. It will give parsing errors if your language has a syntax error. 

Otherwise it shows the Abstract Syntax Tree (AST) that results from parsing your live code. You can unfold the AST branches by clicking on them.

The *DSP Code Output* widget shows the code which Sema generates (Maximilian DSP JavaScript) when you evaluate your live code. 

The first thing that might be useful to develop some intuition is 



<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->