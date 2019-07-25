# TUTORIAL 4
@{%
var semaIR = require('./semaIR.js'); // load additional sound engine functions
console.log(semaIR);

const moo = require("moo"); // load tokeniser

// This time, as well as sample names and whitespace, we want to match integers, and we want to introduce a separator character. Our plan is to play samples back as before, but now also to manipulate their speed. In our new language, typing:

  // click>2

// would play the <click> sample at double speed. */

const lexer = moo.compile({
  click:        /click/,
  convol1:      /convol1/,
  heart:        /heart/,
  separator:    />/,
  number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/, // This is a standard regex sequence for matching integers.
  ws:           {match: /\s+/, lineBreaks: true},
});

%}

# The lexer object is passed to the grammar.
@lexer lexer

main -> _ Statement _
{% d => ({
   "@lang" : d[1]
   })
%}

Statement ->
  SampleName %separator %number # <Statement> contains any of the possible contents of <SampleName> (further down the page), followed by the > separator character, followed by an integer.

  # The array created when Nearley matches <Statement> will be in the format [SampleName, separator, number], so we will access its values accordingly.

  {% d => [ // We create our nested list as usual...
  {"@sigOut": {
    '@spawn':
      { '@sigp':
        { '@params': [
          { '@num': { value: d[2].value } }, // The syntax here might be a little confusing! We access <d[2].value> and not just d[2] because when we initially pass the %number token to the grammar, it is an object. We have to access the integer itself *inside* that object using the <.value> key.
          { '@string': d[0] } // We already returned the sample name as a string with no other data when we matched <SampleName>, so we can simply access d[0].
          ],
          '@func': {
            value: 'loop'
          }
        }
      }
    }
    }]
  %}

  # ALTERNATIVE SYNTAX
  # As before, here is a more concise syntax example using the synth helper function.
  # {% d => [
  #   {"@sigOut":
  #     { "@spawn": semaIR.synth(
  #       'loop',[
  #         semaIR.num(d[2].value),
  #         semaIR.str(d[0])
  #         ]
  #       )
  #     }
  #   }]
  # %}

SampleName -> (%click | %convol1 | %heart)
{% d => d[0][0].value %} # We return the string corresponding to the matched token, as in tutorial 3. Note that this has already taken place when <Statement> is matched.



# ---- RUNNING OUR LANGUAGE ---- #

 # As before, we can test our language by running these commands in the terminal:

   # nearleyc tut4.ne -o livelang.js
    # (compile)

   # nearley-test -i "click>2" livelang.js
    # (test before building)

   # yarn build

   # yarn dev
    # (open a browser window and start SEMA)


# --- WHITESPACE HANDLING ---- #

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
