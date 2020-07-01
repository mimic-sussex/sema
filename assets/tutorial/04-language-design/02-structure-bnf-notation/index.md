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

Our 1-token language will have precisely one specific token, and we can only use that token in the *LiveCode Editor* and nothing else. 

This language will not be useful for much, except for playing one sample and most importantly, help us understand how to use the main blocks and the notation.  

Copy this code snippet and paste it on line 10 of the Grammar Editor.

```
	click: /click/,
	ws: { match: /\s+/, lineBreaks: true }
```

Given that the *Grammar Editor* does continuous evaluation, this code will be compiled on every change and incorporated into the grammar —using the macro `@lexer lexer`— before the parser is generated.


## The Grammar definition

The *Grammar Editor* gives you the ability to create and edit a grammar, which needs to be specified in a special notation—or language, i.e. the [Backus Naur Form (BNF)](http://hardmath123.github.io/earley.html)—and compiled to generate a parser.

BNF defines a set of grammar rules, called *Production Rules*, which take the form of 

**A -> B**

You can read this as "*something on the left side of -> may be replaced by some something-else on the right-side of ->*". 


In our template there are four default production rules which can be changed. 

* **main -> __** 

* **_  -> wschar:**

* **__ -> wschar:+**

* **wschar -> %ws**

Altogether they define a very simple and valid grammar, although not very usefull.

So we are now going to add two production rules to our grammar. Copy and replace the current rule

``` main -> __ ```

with this rule

```
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } } 
%}
```

Now add this rule right afterwards.

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

So we just added two basic rules which specify that a valid sentence in this language:

1.  `main -> _ Statement _` – has one statement surronded by whitespace

2.  `Statement -> %click` – a statement is the word 'click' 

There are more elements of these rules that require explanation, such as the code blocks `{%` and `%}` with Javascript, how to they depend on each other, and why they contain to tokens `%click` and `%ws`. We will cover that in detail on the following "Grammar Rules" section. 


Now you can test out your new 1-token live coding language in the *LiveCode Editor*.



### Exercise 

How will you test your grammar with language? What will you write in the *LiveCode Editor*?

What would you have to do to change the one token of the language? How would you change it?


Next we are going to understand in more detail the elements of the lexer and grammar definitions you have just used and build a more sophisticated language.










