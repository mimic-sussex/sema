# BNF Structure and Notation
 
In this part of the tutorial, we are going to understand the code structure and notations used in the *Grammar Editor*. 

We are also going to understand some of the underlying concepts that are necessary to the language design workflow in Sema.

In the previous tutorial section we've had a look to the full-fledged grammar of Sema's default language. What a hard knock! 😵

Not to worry! In this tutorial we are starting from the ground up with an empty grammar template on the *Grammar Editor*.

## Decoding the template...

If you look closely to the *Grammar Editor* you might notice a few things:

*  there are code comments which begin with ```#```

*  there are code blocks delimited by ```{%``` and ```%}```

*  there seems to be code comments inside the code blocks that begin with ```//``` 

*  there are lines which follow a pattern of SOMETHING ```->``` SOMETHING, 

*  these line are also followed by code blocks ```{%``` ```%}```

Also notice that the *Grammar Compiler Output* says the grammar is valid, but if you evaluate your code on the *LiveCode Editor*, the *LiveCode Parser Output* says there is a syntax error.



## The Lexer definition



## The Grammar definition


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