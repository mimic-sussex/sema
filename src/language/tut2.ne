# TUTORIAL 2

@{%
var semaIR = require('./semaIR.js'); // as before, load the additional functions for the sound engine
console.log(semaIR);

const moo = require("moo"); // load the tokeniser module

/* ---- DEFINING MULTIPLE SAMPLES ---- */

/* We want to be able to play more than just a single click sample. Here we define three sample names in our lexer as well as our whitespace. */

const lexer = moo.compile({
  click:         /click/,
  convol1:       /convol1/,
  heart:         /heart/,
  ws:            {match: /\s+/, lineBreaks: true},
});

%}


# Pass the lexer object as before, using the <@lexer> option
@lexer lexer

main -> _ Statement _ # <main> contains 0 or more whitespaces, followed by any of the possible contents of <Statement> (see below), followed by 0 or more whitespaces. If this matches the text entered then...
  {% d => (
    { "@lang" : d[1] } // ...create the root of the tree of instructions to be sent to the sound engine
    )
  %}

Statement ->
  %click # <Statement> could contain the <click> token, as before. If this matches the text entered then...
  {% d => [ // ...do everything we did in tutorial 1.
  {"@sigOut": {
    '@spawn':
      { '@sigp':
        { '@params': [
          { '@num': { value: 1 } },
          { '@string': 'click' }
        ],
          '@func': {
            value: 'loop'
          }
        }
      }
    }
    }] // This is identical to our <Statement> in tutorial 1, so far. However, we want to introduce a *choice* of samples, so that we can play a different sound by typing something different.
  %}
  | # The pipe character allows us to separate alternative rules for the grammar.
  %convol1 # <Statement> could contain the <convol1> token instead. If this matches the text entered then...
  {% d => [ // do everything we did in the previous rule, with one exception...
  {"@sigOut": {
    '@spawn':
      { '@sigp':
        { '@params': [
          { '@num': { value: 1 } },
          { '@string': 'convol1' } // ...instead of playing the 'click' sample, play the 'convol1' sample.
        ],
          '@func': {
            value: 'loop'
          }
        }
      }
    }
    }]
  %}
  |
  %heart # <Statement> could contain the <heart> token instead. If this matches the text entered then...
  {% d => [
  {"@sigOut": {
    '@spawn':
      { '@sigp':
        { '@params': [
          { '@num': { value: 1 } },
          { '@string': 'heart' } // ...you guessed it! Play the 'heart' sample.
        ],
          '@func': {
            value: 'loop'
          }
        }
      }
    }
    }] // We can theoretically do this with an infinite number of samples, though our file might become quite large.
  %}

  # In tutorial 3, we will write rules to recognise any of the tokens in the lexer without needing to repeat ourselves.


  # ---- ALTERNATIVE SYNTAX ---- #

  # As in tutorial 1, using the 'synth' helper function would look a little more concise, although still repetitive:
    # # %click
    # {% d => [{"@sigOut": { "@spawn": semaIR.synth ('loop',[semaIR.num(1),semaIR.str('click')]) }}] %}
    # |
    # %convol1
    # {% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[semaIR.num(1),semaIR.str('convol1')]) }}] %}
    # |
    # %heart
    # {% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[semaIR.num(1),semaIR.str('heart')]) }}] %}


# ---- RUNNING OUR LANGUAGE ---- #

# As before, we can test our language by running these commands in the terminal:

  # nearleyc tut2.ne -o livelang.js
    # (compile)

  # nearley-test -i "<any of our tokens>" livelang.js
    # (test before building)

  # yarn build

  # yarn dev
    # (open a browser window and start SEMA)


# --- WHITESPACE HANDLING ---- #
# As in tutorial 1, this allows us to handle any amount of whitespace (including none!)

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
