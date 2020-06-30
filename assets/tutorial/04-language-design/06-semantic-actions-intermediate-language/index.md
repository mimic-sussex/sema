# BNF Structure and Notation
 
In this part of the tutorial, we are going to understand the code structure and notations used in the *Grammar Editor*. 

We are also going to understand some of the underlying concepts that are necessary to the language design workflow in Sema.

In the previous tutorial section, we had a look to the fully-fledged grammar of Sema's default language.

In this tutorial we will start from the ground up with an empty grammar template on the *Grammar Editor*.

## Decoding the template...

If you look closely to the *Grammar Editor* content you might notice a few things:

*  there are code comments which begin with ```#```

*  there are code blocks delimited by ```{%``` and ```%}```

*  there seems to be code comments inside the code blocks that begin with ```//``` 

*  there are lines which follow a pattern of SOMETHING ```->``` SOMETHING, 

*  these line are also followed by code blocks ```{%``` ```%}```

Also notice that the *Grammar Compiler Output* says the grammar is valid, but if you evaluate your code on the *LiveCode Editor*, the *LiveCode Parser Output* says there is a syntax error.

This means that the grammar template is well-formed, but needs to be developed to generate a usefull parser for the content of *LiveCode Editor*. 

Now that we have the scaffolding, we are going to fill it in with the grammar for the simplest language as possible, 1-token live coding language! 

This language will not be useful for much, but it will help us understand how to use the main blocks and the notation.   



## The Lexer definition

The *Lexer* or *Tokeniser* definition is the first code block delimited by ```@{%``` and ```%}```. This code does *lexical analysis* of textual content, which means that the *Lexer* is responsible for chopping up all the text in the *LiveCode Editor* into its smallest units (i.e. lexemes or tokens).

However, we do need to define how these units should be recognised. We will do that by adding Javascript code with Regular Expressions (RegEx) to define the pattern to recognise these units. There are many [tutorials](https://www.w3schools.com/jsref/jsref_obj_regexp.asp) and even specialised interactive [tools](https://regex101.com/) available that can you help test your RegEx.

Our 1-token language will have precisely one specific token, and we can only use that token in the *LiveCode Editor* and nothing else. 

Copy this code snippet and paste it on line 10 of the Grammar Editor.

```
	click: /click/,
	ws: { match: /\s+/, lineBreaks: true }
```

Given that the *Grammar Editor* does continuous evaluation, this code will be compiled on every change and incorporated into the grammar —using the macro `@lexer lexer`— before the parser is generated.


## The Grammar definition

The *Grammar Editor* gives you the ability to create and edit a grammar, which needs to be specified in a special notation—or language, i.e. the [Backus Naur Form](http://hardmath123.github.io/earley.html)—and compiled to generate a parser.

BNF defines a set of grammar rules, called *Production Rules*, which take the form of 

**A -> B**

You can read this as "*something on the left side of -> may be replaced by some something-else on the right-side of ->*". 


In our template there are four default production rules which can be changed. 

* **main -> _ | __** 

* **_  -> wschar:**

* **__ -> wschar:+**

* **wschar -> %ws**


Altogether they define a very simple and valid grammar, although not very usefull.


So we are now going to add two production rules to our grammar. Copy and replace the current 

``` main -> __ ```

with this rule

```
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } } 
%}
```

```
Statement -> %click
{% 
  // JS 'arrow' function definition 
  d => [{
    '@spawn': {
      '@sigp': {
        '@params': [{        
          '@sigp': { 
            '@params': [{
                '@num': { value: 1 }
              },
              {
                '@string': 'click'
              }
            ],
            '@func': { value: 'loop'  }
          }
        }],
        '@func' : {
          value: "dac"
        }
      }
    }
  }]
%}
```

Next we are going to 





