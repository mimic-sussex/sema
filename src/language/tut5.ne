# TUTORIAL 5
@{%
var semaIR = require('./semaIR.js'); // sound engine functions
console.log(semaIR);

const moo = require("moo"); // tokeniser

// What if we want to play two samples at the same time?

const lexer = moo.compile({
  click:        /click/,
  convol1:      /convol1/,
  heart:        /heart/,
  insec3:       /insec3/,
  paper:        /paper/,
  separator:    />/,
  number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  ws:           {match: /\s+/, lineBreaks: true},
});

%}

# The lexer object is passed to the grammar.
@lexer lexer

main -> _ Statement _ # <main> contains 0 or more whitespaces, followed by the contents of <Statement> (see below), followed by 0 or more whitespaces, as previously.
{% d => ({
   "@lang" : d[1]
  })
%}

Statement ->
  SampleName %separator %number _ SampleName %separator %number # <Statement> contains any of the possible contents of <SampleName> (see below), followed by the separator character >, followed by an integer, followed by any of the possible contents of <SampleName>, followed by >, followed by an integer. If this matches the text entered...
  {% d =>
    [ { '@sigOut': // ...start building the tree of instructions.
       { '@spawn':
          { '@sigp':
             { '@params':
                [ { '@sigp':
                     { '@params':
                       [ { '@num':
                         { value: d[2].value  } },
                         { '@string': d[0] } ], // we get the speed and sample name parameters exactly as we did in tutorial 4
                       '@func': { value: 'loop' }
                     }
                   },
                  { '@sigp':
                     { '@params':
                       [ { '@num':
                         { value: d[6].value } }, // everything is now wrapped in one array, so we access the values with different indexes for each signal processor
                         { '@string': d[4] } ],
                       '@func': { value: 'loop' }
                       }
                     }
                   ], // Note that we build one @sigp for each of our two sounds, then wrap them both up in the parameters array for a third @sigp.
               '@func': {
                 value: 'mix' // We then use the 'mix' function (see https://github.com/mimic-sussex/eppEditor/blob/master/doc/semaIR.md) on the wrapper @sigp to calculate the average amplitude, or level, of the two signals, and to allow them to play simultaneously without being too loud.
               }
             }
           }
         }
     } ]
  %}

# ALTERNATIVE SYNTAX
# As before, here is a more concise syntax example using the synth helper function.
# {% [
#   { "@sigOut":
#     { "@spawn":
#       semaIR.synth(
#         'mix',[
#           semaIR.synth(
#             'loop',[
#               semaIR.num(d[2].value),
#               semaIR.str(d[0])
#             ]
#           ),
#           semaIR.synth(
#             'loop',[
#               semaIR.num(d[6].value),
#               semaIR.str(d[4])
#             ]
#           )
#         ]
#       )
#     }
#   }
# ] %}


SampleName -> (%click | %convol1 | %heart | %insec3 | %paper) # We return the string corresponding to the matched token, as in tutorials 3 and 4.
{% d =>
  d[0][0].value
%}

# ---- RUNNING OUR LANGUAGE ---- #

# To test our language, in the terminal navigate to this folder and run:

  # nearleyc tut5.ne -o livelang.js
    # (compile our grammar)

  # nearley-test -i "click>1 convol1>2" livelang.js
    # (test the grammar before building)

  # yarn build

  # yarn dev
    # (open a browser window and start SEMA)


# --- WHITESPACE HANDLING ---- #

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
