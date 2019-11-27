# TUTORIAL 1

@{%
var semaIR = require('./semaIR.js'); // this loads some additional functions for the sound engine
console.log(semaIR);

const moo = require("moo"); // this loads the tokeniser module

/* ---- THE LEXER ---- */

/* The JavaScript object below is the lexer. The lexer separates the text you type into SEMA into tokens (words or other groups of characters). Anything defined here can be used in your grammar.

Here we are defining tokens for a very simple live-coding language. It will recognise the word <click>, it will recognise whitespace, but it will not recognise anything else. */

const lexer = moo.compile({
  click:     /click/, // match the string 'click'
  ws:        {match: /\s+/, lineBreaks: true}, // match whitespace
});

%}

# ---- HOW THE LEXER IS STRUCTURED ---- #

# The text before the : is just a keyword, which we will use to refer to the token in the grammar itself.

# The text after the : is the regex search used to match the actual text typed into SEMA in the browser window. A simple regex tutorial is available here - <https://medium.com/front-end-weekly/a-practical-beginners-guide-to-regex-regular-expressions-2faccbda117d> - but you can often find what you need with a web search.


# The lexer object is then passed to the grammar using the <@lexer> option.
@lexer lexer


# ---- THE GRAMMAR ---- #

# Under the hood, the text will be analysed by the Nearley parser. Its syntax is documented at https://nearley.js.org/docs/grammar, and you can experiment with it at https://omrelli.ug/nearley-playground/.

  # Note that the playground does not use a lexer. The playground will let you simply match the hardcoded string 'click', but if you try to do the same in this file, it will not work - you *must* define your tokens in the lexer.


# ---- CREATING OUR FIRST GRAMMAR ---- #

# We conventionally begin our grammar with <main>.

# When a token is matched, we can execute some JavaScript (which we place between {% %} signs). We use this to build a branching structure (or tree) of instructions to send to the audio engine.

# (Make sure to leave semicolons out of your JS - the parser doesn't like them!)

main -> _ Statement _ # <main> contains 0 or more whitespaces, followed by the contents of <Statement> (see below), followed by 0 or more whitespaces. If this matches the text entered then...
  {% d => (
    { "@lang" : d[1] } // ...create the root of the tree of instructions (which will contain everything else).
    )
  %}

# See <https://github.com/mimic-sussex/eppEditor/blob/master/doc/semaIR.md> for available functions.

# We refer to our lexer keywords with a % sign.

Statement -> %click # <Statement> contains the <click> token. If this matches the text entered then...
  {% d => [ // create a nested list of objects to be sent to the audio engine
  {"@sigOut": {
    '@spawn': // ...spawn branching instructions for the audio engine...
      { '@sigp': // start the signal processor
        { '@params': [
          { '@num': { value: 1 } }, // ...play the sample at speed 1...
          { '@string': 'click' } // ...and make it the 'click' sample...
        ],
          '@func': {
            value: 'loop'
          } // ...then loop it for ever and ever. */
        }
      }
    }
    }]
  %}

  # ---- ALTERNATIVE SYNTAX ---- #

  # We could also do this a bit more concisely using the 'synth' helper function (which is defined in the file semaIR.js).
    # {% d => [{"@sigOut": {
    #   "@spawn":
    #     semaIR.synth(
    #       'loop',
    #       [semaIR.num(1),semaIR.str('click')]
    #     )
    #   }
    # }]
  # %}

# ---- RUNNING OUR LANGUAGE ---- #

# To test our language, in the terminal navigate to this folder and run:

  # nearleyc tut1.ne -o livelang.js
    # (compile our grammar)

  # nearley-test -i "click" livelang.js
    # (test the grammar before building)

  # yarn build

  # yarn dev
    # (open a browser window and start SEMA)

# --- WHITESPACE HANDLING ---- #
# This just allows our lexer to match any amount of whitespace (including none).

_  -> wschar:*    {% function(d) {return null;} %} # 0 or more whitespace characters
__ -> wschar:+    {% function(d) {return null;} %} # 1 or more whitespace characters

wschar -> %ws     {% id %}
