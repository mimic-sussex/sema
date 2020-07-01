# Grammar Rules
 
In this part of the tutorial, we are going to understand the grammar definition in the *Grammar Editor* in more detail, develop it and the Lexer definition a bit futher to make our our live code language more expressive. 


## The Lexer definition


Our previuos 3-token language had 3 tokens, *click*, *convol1* and *heart*. We are adding up more patterns and give our language  sophisticated language, a 3-token language.

Copy this code snippet and paste it on line 10 of the Grammar Editor.

```
    convol1:  /convol1/,                         
    heart:    /heart/,   
	click:    /click/,
	ws: { match: /\s+/, lineBreaks: true }
```

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





