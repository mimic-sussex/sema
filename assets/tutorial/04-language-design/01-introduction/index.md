# Introduction to Language Design
 
In this part of the tutorial, we are going develop some knowledge about the language design workflow in Sema.

We will be focusing on the *Grammar Editor*, and more specifically, in: 

* how it can help you customise or create a new language from scratch.

* how it interacts with the *Live Coding Editor* and the debugging widgets, and how to use these to test out our custom language as we go.

* the notation that it accepts and the structure of this notation.

We will finish this section with an exercise, in which you will create a new language from the default language which you have been learning previously, just by changing one element only.

For this work we need to understand a few key features of Sema and its language design concepts:

## Grammars in a nutshell

Creating a new language is no small task! It requires design, philosophy and logic. However, it ranges from modifying existing language (for example by changing its syntax) to actually creating a brand new language. 

If you think back to your language lessons you might remember that a grammar defines the rules of a language. Basically, a grammar says what is what in the elements of a sentence (e.g. a noun, a verb, an adjective) and how they relate.  

The *Grammar Editor* gives you the capability to create and edit a grammar, which specifies how a live language is. The grammar, which is specified in a special notation—or language, i.e. the [Backus Naur Form](http://hardmath123.github.io/earley.html)—is compiled to generate a parser.

A parser is nothing more than a process which breaks down the text that you enter in the *LiveCode Editor* and organises it in a way which makes it easier to understand what the text means. 

The result is a tree-like structure called Abstract Syntax Tree, which keeps the broken-down bits of text organised and labeled, and that you can see in the *Live Code Parser Output*. 

There is a lot that could be said about grammars, parsers and compilers, but you can find a few simple and user-friendly tutorials to start with [here](https://medium.com/@gajus/parsing-absolutely-anything-in-javascript-using-earley-algorithm-886edcc31e5e) and in the link above.


## Grammar Editor Interaction(s)

When editing the content in the *Grammar Editor*, you don't need to hit **cmd-Enter**/**ctrl-Enter** to evaluate changes. Rather, this editor does continuous evaluation, which means that on every keystroke, every change, a new parser is generated and immediately applied to analyse the content of the LiveCode Editor.  

If the grammar specification is correct, the *Grammar Compiler Output* will show "*grammar validated and the parser generated!*" in green. 

However, it will give compilation errors if your grammar specification: 
1. has a syntax error 
2. has ill-defined rules
3. is ambiguous

We will be looking into these problems in more detail. 

Once the parser is operational, the *Live Code Parser Output* will provide feedback on the compilation of your custom-language. It will give parsing errors if your language has a syntax error. 

Otherwise it will show the *Abstract Syntax Tree* (AST) that results from parsing your live code. You can unfold the AST branches by clicking on them.

The *DSP Code Output* widget shows the code which Sema generates (Maximilian DSP JavaScript) when you evaluate your live code. 

The first thing that might be useful to develop some intuition is to correct a basic syntax error on a grammar. 

## *A simple exercise* 

You will find the grammar of Sema's default language of the Grammar Editor widget. 
However, there is an error preventing the language to be compiled! 

**What do you need to change?** 

On the second part of the exercise, we are going to create a new language by tweaking the default one.


Copy and replace lines 9 and 10 on the grammar editor with this code:

```
	paramEnd:    /\)/,
	paramBegin:  /\(/, 
```

But... what happens if you now evaluate the code on the LiveCode Editor? 

All you have to do is to update the code in LiveCode Editor to reflect the new syntax!

🥁🥁🥁 You have just created a new default-language-derived language! 🍾 🎉🎉

Next we are going to understand how to do this bottom up. Stay tuned!



<!-- the Maximilian DSP -->

<!-- ## Post-It Window -->

<!-- The *Post-It* widget  -->

<!-- ## Store Inspector

The *Store Inspector* widget  -->