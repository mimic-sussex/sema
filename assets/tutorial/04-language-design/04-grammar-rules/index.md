# Grammar Rules
 
In this part of the tutorial, we are going to understand the *production rules* of the  grammar definition in more detail. Our grammar definition has evolved and it is slowly becoming more powerful. 

We are going to explore and develop both grammar rules and the tokens in the Lexer definition a bit futher to make our live code language more expressive. 


## The Grammar definition

One alternative way of defining grammar rules with the same left-hand side is to aggregate them in one rule with alternative right-hand side derivations. 

You can use the `|` operator to express alternative right-hand side derivations for *Statement*, like so:

main -> _ Statement _

Statement -> %click 
|
%convol1
|
%click

_  -> wschar:*

__ -> wschar:+

wschar -> %ws

This makes the grammar more readable and helps to compare the different derivations for each rule. 

The current version of the grammar in the Grammar Editor has the 3-token grammar of the previous tutorial with this transformation applied. Note that each rule still keeps the code blocks `{%` `%}`.

But what the heck are these code blocks?! 

### Semantic Actions 

The code blocks that come after each rule `{%` `%}` are called *semantic actions*. 

To understand what these semantic actions do, you should first know when they are applied. They are applied when a token is recognised in a string being evaluated.

A parser analysing a string to find a token is driven by the rules of the grammar. To find the token the parser drills down the rules until it finds the token.

When a token is found, the parser initiates the inverse path, which is bubbling up through the rules that led to the recognition, until it reachs the main rule again. The semantic action executes on each rule where this bubbling up occurs.

For instance, when you evaluate the live code with `click`, what happens is:

the word click is first evaluated against the elements of the right-hand side of `main`:

1. `_`, against `Statement`, and against `_`. None of them match because they are not tokens. So drill down happens for all of them.

2. they will be then matched against all the *right-hand sides* of `_`, of `Statement`, `_` and so on.

3. in the case of our very simple grammar, the match will happen on the *right-hand side* of `Statement -> %click`

4. That is when this Javascript arrow function executes, and returns a list with this nested structure.
```
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
```

5. this list bubbles up to the `main` rule, via `Statement` which matches d[1].
```
	d => ( { "@lang": d[1] } )
``` 

Basically we are building the abstract tree as we bubble up. The final result is the syntax tree that gets rendered and that you can inspect in the *Live Code Parser Out*.

In a nutshell, this is the Earley algorithm applied to our `click` instruction. You can read more about it [here](https://doi.org/10.1145/362007.362035).


## Adding oscillators

Now, let's add MOAR stuff! Let's add another feature to our language, an oscillator. We need to add a RegEx to our Lexer definition, like so:

```
    saw:      /saw/,
    convol1:  /convol1/,                         
    heart:    /heart/,   
    click:    /click/,
    ws: { match: /\s+/, lineBreaks: true }
```

And now were are going to add a rule with the `saw` token to the grammar definition section, right after rule for `click`. 


```
|
%saw
{% 
  // JS 'arrow' function definition 
  d => [{
    '@spawn': {
      '@sigp': {
        '@params': [{        
          '@sigp': { 
            '@params': [{
                '@num': { value: 10 }
              },
            ],
            '@func': { value: 'saw'  }
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

Notice what differences between the *semantic actions* of the `click` sample and the sawtooth.

What happens if you change the value of `@func` from `saw` to `sin`?

`'@func': { value: 'saw'  }`



## Capturing values with more expressive tokens 

So far the tokens in our lexer definition were fixed RegExs, which recognised a limited set of strings. They served the purpose of helping us understand how to orchestrate the recognition of a token with a grammar rule. 

However, now we want to tap into the power of RegExs to recognise more complex tokens.


```
    heart:    /heart/,
    click:    /click/,
    osc:      /[a-z]+/,
    ws: { match: /\s+/, lineBreaks: true }
```

Notice that rather than hardcoding the value of `@func` with the kind of oscillator, we are now setting it with the value recognised by the token `osc`.  

```
Statement -> %osc 
{% 
  // JS 'arrow' function definition 
  d => [{
    '@spawn': {
      '@sigp': {
        '@params': [{        
          '@sigp': { 
            '@params': [{
                '@num': { 
                  value: 100 
                }
              },
            ],
            '@func': { value: d[0].value  }
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



What happens if you change the `@num` value on both the rules ?


## Adding numbers

In order to the give our language the ability to control the numerical parameter in the sample and in the oscillator, we are now going to extend it to recognize a kind of token: a *number*

```
    saw:      /saw/,                         
    heart:    /heart/,
    click:    /click/,
    number:   /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
	ws: { match: /\s+/, lineBreaks: true }
```

Now we need to bubble up the recognised numerical value into our grammar rule

	
```
Statement -> %saw __ %number
{% 
  // JS 'arrow' function definition 
  d => [{
    '@spawn': {
      '@sigp': {
        '@params': [{        
          '@sigp': { 
            '@params': [{
                '@num': {
                  value: d[2].value 
                }
              },
            ],
            '@func': { value: 'saw'  }
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

Now you that you can control a parameter of the sawtooth oscillator, how would you go about making this rule generic for all types of oscillators?

Did you face an issue doing that? Try changing the order of the RegExs in the Lexer definition so that the more specific token definitions come before the more generic ones.

Next, we will be looking at increasing the complexitiy of our grammar rules to make our language even more powerful.

