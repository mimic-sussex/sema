# Recursion and lists

Recursion is the key to making new languages. Recursion opens up the possibilities for creating languages which have variance in them, and that will adapt to many different patterns of input.

In this tutorial we're going to go through the process of making a very simple language. Let's sketch it out first.

## Drone++

drone++ is a language for creating drone sounds with one or more saw wave oscillators.  Here's how it will look.

Create a saw wave at 100 hz
```
100
```

Create two saw waves at 100Hz amd 103Hz and mix them together
```
100,103
```

Create two saw waves at 100Hz, 103Hz and 200Hz and mix them together

```
100,103,200
```

Basically it's just lists of numbers, one for the frequency of each saw oscillator



## DSP code

When you make a new language, you need to think about how the code will look that you send to the audio engine.  It might be useful to think about how the system might look in the default language, whose semantics are quite close to Sema's internal type system.

Playing a saw wave:
```
{{100}saw}dac;
```

Playing more than one saw wave:
```
{{{100}saw, {101}saw}mix}dac;
```

You could look at the trees that these code snippets create, using the *live code parser output* window.  These are the kinds of tree that our new language, drone++, will be making.


## Building the language

### Step 1: Start small and build upwards: begin with a language that just plays a single saw wave at a fixed frequency.

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    ws: { match: /\s+/, lineBreaks: true }
  });
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> %number
{%
  d => [{
    '@spawn': {
      '@sigp': {
        '@params': [{        
          '@sigp': {
            '@params': [{
              '@num': { value: 100 }
            }],
            '@func': { value: "saw"  }
          }
        }],
        '@func' : { value: "dac" }
      }
    }
  }]
%}

# Whitespace
_  -> wschar:* {% d => null %}
__ -> wschar:+ {% d => null %}
wschar -> %ws {% id %}
```

This is the first step in making our language.  Points to note in this language:

1. the number token in the lexer.  This looks complicated!  It's a *regex* to match numbers. It will match whole numbers and floating point numbers.
2. The tree which `Statement` translates into.  This creates a saw wave which is sent through an audio output.

To use this language, type in any number and evaluate it. Try typing in something that's not a number - you'll get an error. Whatever number you type, it will play a 100Hz saw wave. The next step then is clear...

### Step 2: Upgrade the language, so that you can control the frequency of the saw wave

Firstly, we can express the grammar in a slightly longer form, but which will be more readable.

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here  
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    ws: { match: /\s+/, lineBreaks: true }     
  });
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> %number
{%
  function(d){
    let sawosc =
      {'@sigp': {
        '@params': [{
          '@num': { value: 100 }}],
        '@func': { value: "saw"  }
      }};

    let tree = [{
      '@spawn': {
        '@sigp': {
          '@params': [ sawosc ],
          '@func' : {value: "dac"}}}
    }];
    return tree;
  }
%}



# Whitespace
_  -> wschar:* {% d => null %}
__ -> wschar:+ {% d => null %}
wschar -> %ws {% id %}
```

Here, the structure for the saw oscillator is separated from the rest of the tree structure,  put into the variable sawosc, and then integrated into the main tree in the ```@params``` object in the ```dac``` structure.  This code uses the slightly longer format of a full javascript function.

It might be useful to review at this point - we're specifying a simple language that recognises a single number, and then converting that number into a structure that will tell Sema to make a saw wave oscillator. 

Now we want to vary the frequency of the saw wave.  When the rule ```Statement -> %number``` is parsed, we receive the data in the variable ```d```, passed into our function that is processing the rule.  The rule has a single element, ```%number```, so it's contents will be contained in the first element: ```d[0]```.

We can use this number to control the frequency of the saw wave by modifying the ```sawosc``` object:

```
let sawosc =
  {
    '@sigp': {
      '@params': [{
        '@num': { value: d[0].value }
      }],
      '@func': { value: "saw"  }
  }};
```

so now, the whole code looks like this
```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here  
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    ws: { match: /\s+/, lineBreaks: true }        
  });
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> %number
{%
  function(d){
    let sawosc =
      {'@sigp': {
        '@params': [{
          '@num': { value: d[0].value }}],
        '@func': { value: "saw"  }
      }};
    let tree = [{
    '@spawn': {
      '@sigp': {
        '@params': [ sawosc ],
        '@func' : { value: "dac" }
      }}
    }];
    return tree;
  }
%}

# Whitespace
_  -> wschar:* {%  d => null%}
__ -> wschar:+ {% d=> null%}
wschar -> %ws {% id %}
```

Try livecoding the number. It should change the frequency of the oscillator.

Now let's expand this language a little, to move towards our goal...

### Step 3: A language to control two saw oscillators

This language will look something like this:

```
100,300
```

Two numbers separated by a comma.

We need to define a separator - by adding it to the lexer
```
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here  
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    separator: /,/,
    ws: { match: /\s+/, lineBreaks: true }
  });
%}
```

A new rule for statement:
`
Statement -> %number %separator %number
`

And an expanded function, for turning this rule into the IR format - this is the complete grammar:

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here  
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    separator: /,/,
    ws: { match: /\s+/, lineBreaks: true }
  });
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{%
  function(d){ return { "@lang": d[1] } }
%}

Statement -> %number %separator %number
{%
  function(d){
    let sawosc = {
      '@sigp': {
        '@params': [{
          '@num': { value: d[0].value }
        }],
        '@func': { value: "saw"  }
      }};

    let sawosc2 = {
      '@sigp': {
        '@params': [{
          '@num': { value: d[2].value }
        }],
        '@func': { value: "saw"  }
    }};

    let mixer = {
      '@sigp': {
        '@params': [ sawosc, sawosc2 ],
        '@func': { value: "mix"  }
    }};

    let tree = [{
      '@spawn': {
        '@sigp': {
          '@params': [ mixer ],
          '@func' : {value: "dac"}}}
        }];
      return tree;
  }
%}



# Whitespace
_  -> wschar:* {%  d => null%}
__ -> wschar:+ {% d=> null%}
wschar -> %ws {% id %}
```

Give it a try in the livecoding window.

In the rule processing function, two saw oscillators are created, along with a mixer to mix them together.  The first frequency number is contained in ```d[0].value``` and the second is in ```d[2].value```.  ```d[1]``` contains the separator, we an just ignore it as it contains no information that we need to make sound.  

This language is fixed to two oscillators.  We could go on adding oscillators to the grammar, but this would be laborious and we would only ever have a fixed number available.  We want drone++ to make a variable number of oscillators. This is where recursion comes in.  Below is our final grammar, the key changes are explained underneath.

### Step 4:  Add a recursive rule to allow for a variable number of oscillators
```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here  
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    separator: /,/,
    ws: { match: /\s+/, lineBreaks: true } 
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
    let mixer = {
      '@sigp': {
        '@params': d[0],
        '@func': { value: "mix"  }
      }};

    let tree = [{
    '@spawn': {
      '@sigp': {
        '@params': [ mixer ],
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
    let sawosc = {
      '@sigp': {
        '@params': [{
          '@num': { value: d[0].value }}],
        '@func': { value: "saw" }
      }};
    return sawosc;
  }
%}

# Whitespace
_  -> wschar:* {% d => null %}
__ -> wschar:+ {% d => null %}
wschar -> %ws {% id %}
```
Firstly, try livecoding this language. Now you can make a list of frequencies that is as long as you wish, and they will play as saw oscillators. e.g.

```
50,51,52,53,54,55
```

Let's look at some individual parts so we can try and understand how we got from the previous step to this one.

```
Statement -> OscillatorList
{%
  function(d){
    let mixer = {
      '@sigp': {
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
```

The ```Statement``` rule has been redefined. It now decomposes into another rule called ```OscillatorList```. It's expecting ```d``` to be an array of saw oscillators, which will be passed straight into the ```mixer``` structure.


Towards the end of the code, we have a rule for defining an oscillator:
```
Oscillator -> %number
{%
  function(d){
    let sawosc = {
      '@sigp': {
        '@params': [{'@num': { value: d[0].value }}],
      '@func': { value: "saw" }
		}};
		return sawosc;
  }
%}
```

Like in the previous example, we take a number and turn it onto an oscillator structure.  This gets passed up the rule chain, and eventually arrives in the mixer.  But what happens in-between?  This is the new structure we need to learn: recursion.

```
OscillatorList ->
  Oscillator
  {% d => [d[0]] %}
  |
  Oscillator _ %separator _ OscillatorList
  {% d => d[4].concat(d[0]) %}
```

The function of this rule is to collect one or more of the oscillators and compile them into a list, which will get sent to the mixer.  Let's look at this first without the data conversion functions.

```
OscillatorList ->
  Oscillator
  |
  Oscillator _ %separator _ OscillatorList
```

This is the recursive rule. Generally, we use grammar rules to tell the parser about the structures it expects to find in our language, so that it can match to them, and turn them into the tree structure that Sema can understand.  In this case we have a structure: ```OscillatorList``` which can either be a single ```Oscillator```, or an ```Oscillator``` followed by more oscillators. 

It's a recursive pattern because it contains itself. It is repeatedly applied to a list of ```Oscillator``` elements until it has processed them all.  This means that it can match to as many ```Oscillator``` elements as there are present in the code.

You can look at this another way, thinking about how this rule has a fixed part and a recursive part.  The recursive part is applied repeatedly to the list until there is only one element left to process, in which case it matches the fixed part of the rule and completes.

How about the data conversion functions? The first element is this:

```
Oscillator {% d => [d[0]] %}
```

An ```Oscillator``` element will get turned into an array with a single element: the oscillator structure that is passed up from the ```Oscillator``` rule.

```
Oscillator _ %separator _ OscillatorList
{% d => d[4].concat(d[0]) %}
```

This part of the rule is the recursive part.  As it processes the list of ```Oscillator``` elements, it keeps adding them to and array, using JavaScripts ```concat``` function.  This array of oscillators will be passed up to the mixer.

This recursive structure occurs somewhere in most grammars.


### Next steps

Try to experiment with this grammar yourself.  Here are some possible variations:

#### Variation 1:

This variation includes a letter before the frequency to determine the oscillator type (t: tri, s:saw)

```
t100,t120,s50
```


```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
    const lexer = moo.compile({
        // Write the Regular Expressions for your tokens here  
        number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
        separator: /,/,
				saw: /s/,
				tri: /t/,
        ws: { match: /\s+/, lineBreaks: true } 
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
    let mixer = {
      '@sigp': {
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


Oscillator -> OscillatorType %number
{%
  function(d){
    let sawosc = {
      '@sigp': {
        '@params': [{
          '@num': { value: d[1].value }}],
          '@func': { value: d[0]  }
        }};
    return sawosc;
  }
%}

OscillatorType -> 
  %saw 
  {% d => 'saw' %}
  | 
  %tri 
  {%d => 'tri' %}

# Whitespace
_  -> wschar:* {% d => null%}
__ -> wschar:+ {% d => null%}
wschar -> %ws {% id %}
```

#### Variation 2:

This variation adds a high pass filter to any oscillator with an 'f' in front of it

```
50,f100,f54
```

```
# drone++
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    // Write the Regular Expressions for your tokens here  
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
    separator: /,/,
    filter: /f/,
    ws: { match: /\s+/, lineBreaks: true }  
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
    let mixer = {
      '@sigp': {
        '@params': d[0],
        '@func': { value: "mix"  }
    }};
    
  let tree = [{
    '@spawn': {
      '@sigp': {
        '@params': [mixer],
        '@func' : {value: "dac"}}
    }
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


Oscillator -> %filter:? %number
{%
  function(d){
    let tree = {
      '@sigp': {
        '@params': [{
          '@num': { value: d[1].value }
        }],
        '@func': { value: "saw"  }
      }
    };

    if (d[0] != null) {
      tree = {
        '@sigp': {
    	    '@params': [
            tree, {
              '@num': { value: 500}
            },{
              '@num': { value: 2}
          }],
    	    '@func': { value: 'hpz' }
        }
      };
    }
    return tree;
  }
%}



# Whitespace
_  -> wschar:* {% d => null %}
__ -> wschar:+ {% d => null %}
wschar -> %ws {% id %}
```
