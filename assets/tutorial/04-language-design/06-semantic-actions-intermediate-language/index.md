# Semantic Actions in the Intermediate language

Up until this point in the tutorials we have built abstract syntax trees by putting together arrays of raw objects.  This was important to demonstrate how things are working in the background, but it also has some disadvantages that it can make the grammar difficult to read as the objects are quite verbose.  

As we've seen before, the parser system that we use, *nearley*, also allows you to create your own JavaScript functions to aid putting together trees.  Sema provides some simple utility functions to help with this. You can also make your own functions. 

Let's look at the provided functions first.

```
sema.num(number)
```

This creates the tree structure for a number.

```
sema.string(string)
```

creates the tree structure for a string.

```
sema.synth(functionname, [param1, param2,...])
```

creates the structure for a ```@SIGP``` function.

For example, here's the *drone++* language from the previous tutorial:

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
    const lexer = moo.compile({
        // Write the Regular Expressions for your tokens here  
        number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
                separator: /,/
    });
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> OscillatorList
{%
  function(d){
        let mixer =
        {'@sigp': {
        '@params': d[0],
        '@func': { value: "mix"  }
        }};

        let tree = [{
        '@spawn': {
            '@sigp': {
                '@params': [mixer],
                '@func' : {value: "dac"}}}
            }];
        return tree;
    }
%}


OscillatorList ->
Oscillator
{% d => [d[0]] %}
|
Oscillator _ %separator _ OscillatorList
{% d => d[4].concat(d[0]) %}


Oscillator -> %number
{%
  function(d){
        let sawosc =
        {'@sigp': {
        '@params': [{'@num': { value: d[0].value }}],
        '@func': { value: "saw"  }
        }};
        return sawosc;
    }
%}

# Whitespace
_  -> wschar:* {%  d => null%}
__ -> wschar:+ {% d=> null%}
wschar -> %ws {% id %}
```

Applying these helper functions results in this more readable grammar.

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
    const lexer = moo.compile({
        // Write the Regular Expressions for your tokens here  
        number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
                separator: /,/
    });
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> OscillatorList
{%
  function(d){
		let mixer = sema.synth('mix', d[0]);
		let dac = sema.synth('dac', [mixer]);
    let tree = [{'@spawn': dac}];
		return tree;
  }
%}

OscillatorList ->
Oscillator
{% d => [d[0]] %}
|
Oscillator _ %separator _ OscillatorList
{% d => d[4].concat(d[0]) %}


Oscillator -> %number
{%
  function(d){
		let frequency = sema.num(d[0].value);
		let sawosc = sema.synth('saw', [frequency]);
    return sawosc;
    }
%}

# Whitespace
_  -> wschar:* {%  d => null%}
__ -> wschar:+ {% d=> null%}
wschar -> %ws {% id %}
```

Important points to note above:  the frequency is converted to a number using ```sema.num``` and the `sigp` structures are all converted to ```sema.synth```.

You can define your own functions in the top part of the script between ```@{%``` and ```%}```.  For example, in the above script, you could move the code for the ```Statement``` rule to the top.

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
    const lexer = moo.compile({
        // Write the Regular Expressions for your tokens here  
        number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
                separator: /,/
    });

function mixOscillators(oscList) {
		let mixer = sema.synth('mix', oscList);
		let dac = sema.synth('dac', [mixer]);
    let tree = [{'@spawn': dac}];
		return tree;
}
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> OscillatorList
{% d=> mixOscillators(d[0]) %}

OscillatorList ->
Oscillator
{% d => [d[0]] %}
|
Oscillator _ %separator _ OscillatorList
{% d => d[4].concat(d[0]) %}


Oscillator -> %number
{%
  function(d){
		let frequency = sema.num(d[0].value);
		let sawosc = sema.synth('saw', [frequency]);
    return sawosc;
    }
%}

# Whitespace
_  -> wschar:* {%  d => null%}
__ -> wschar:+ {% d=> null%}
wschar -> %ws {% id %}
```

The `mixOscillators` function is separated into the top portion of the script.  This kind of formatting helps to keep the grammar more readable, and therefore easier to edit.

These helper functions are documented along with the rest of the Sema Intermediate Representation: https://github.com/mimic-sussex/sema/blob/master/docs/sema-intermediate-language.md
