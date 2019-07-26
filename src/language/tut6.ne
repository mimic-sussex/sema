# TUTORIAL 6
@{%
var semaIR = require('./semaIR.js'); // sound engine functions
console.log(semaIR);

const moo = require("moo"); // tokeniser

const lexer = moo.compile({
  click:         /click/,
  convol1:       /convol1/,
  heart:         /heart/,
  insec3:        /insec3/,
  paper:         /paper/,
  separator:     />/,
  number:        /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  ws:            {match: /\s+/, lineBreaks: true},
});

%}

# So far, the number of samples we can use simultaneously has been limited by the number of @sigps we can hard-code. How can we generate new signal processors as and when we need them?

# It might make more sense here to read the parser expressions in reverse order, scrolling to the bottom and starting from <SampleName>, moving on to <SampleAndSpeed>, then <Statement>, then <main>, in order to follow the flow of information when matches are found.

# The lexer object is passed to the grammar.
@lexer lexer

main -> _ Statement _
{% d =>
  ( { "@lang" : // We start the language as usual...
    [ { '@sigOut':
       { '@spawn':
          { '@sigp':
            { '@params': d[1],
              '@func': { value: 'mix' } // but notice that we spawn the branching instructions and our wrapper signal processor here, as a container for as many iterations of our repeating <SampleAndSpeed> units as we need.
            }
          }
        }
     } ]
  } )
%}

# ALTERNATIVE SYNTAX
# {% d =>
#   ({ "@lang" :
#   [{"@sigOut": { "@spawn":semaIR.synth('mix',d[1])}}]
#   })
#
# %}

Statement ->
  SampleAndSpeed _ Statement # <Statement> contains the contents of <SampleAndSpeed>, a single whitespace, and a further iteration of <Statement> (which can, in theory, be endlessly recursive!). If this matches the text entered (which will be the case if the user enters valid syntax for multiple valid samples)...
  {% d => {
    return d[2].concat(d[0]) // ...we join the arrays containing our signal processors together into one array.
  }
  %}
  |
  SampleAndSpeed # <Statement> contains just the contents of <SampleAndSpeed>. If this matches the text entered (which will be the case if the user enters valid syntax for a single valid sample)...
  {%
    d => d // ...we return the array containing our single signal processor as-is.
  %}


SampleAndSpeed ->
  SampleName %separator %number # <SampleAndSpeed> contains any of the possible contents of <SampleName>, the > character, and an integer.
  {% d => (
      { '@sigp': // We create instructions for a signal processor on its own, without any sort of branching instructions containing it.
        { '@params': [
            { '@num': { value: d[2].value } }, // (and we access its parameters exactly as in previous tutorials.)
            { '@string': d[0] }
          ],
          '@func': { value: 'loop' }
        } // We can treat this signal processor as a unit that can be repeated as many times as we need.
      }
    )
  %}

  # ALTERNATIVE SYNTAX
  # {% d =>
  #     semaIR.synth(
  #       'loop',
  #       [ semaIR.num(d[2].value),
  #         semaIR.str(d[0])
  #       ]
  #     )
  # %}

SampleName -> (%click | %convol1 | %heart | %insec3 | %paper)
{%
  d =>
    d[0][0].value // We return the string corresponding to the matched token, as in previous tutorials.
%}


# ---- RUNNING OUR LANGUAGE ---- #

# To test our language, in the terminal navigate to this folder and run:

  # nearleyc tut6.ne -o livelang.js
    # (compile our grammar)

  # nearley-test -i "click>1 convol1>2 heart>1 click>2" livelang.js
    # (test the grammar before building)

  # yarn build

  # yarn dev
    # (open a browser window and start SEMA)


# --- WHITESPACE HANDLING --- #

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
