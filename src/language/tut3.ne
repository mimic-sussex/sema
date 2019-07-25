# TUTORIAL 3
@{%
var semaIR = require('./semaIR.js'); // load additional sound engine functions
console.log(semaIR);

const moo = require("moo"); // load tokeniser

const lexer = moo.compile({
  click:         /click/,
  convol1:       /convol1/,
  heart:         /heart/,
  ws:           {match: /\s+/, lineBreaks: true},
});

%}

# The lexer object is passed to the grammar.
@lexer lexer

main -> _ Statement _ # We begin exactly as in previous tutorials.
{% d => ({
   "@lang" : d[1]
   })
%}

Statement -> SampleName # <Statement> contains any of the possible contents of <SampleName> (see below).

# Scroll down to <SampleName>, near the bottom of this document, before we move on to the JS we'll execute when <Statement> is matched. Come back here when you're done!

#############

# Welcome back! We worked out that when <SampleName> is matched, it will always return the name of our sample as a string.

# When <Statement> (containing <SampleName>) is matched, we can execute some more JS to send a tree of instructions to the sound engine, as we did in the previous tutorials.

{% d => [ // We create our nested list as usual...
{"@sigOut": {
  '@spawn':
    { '@sigp':
      { '@params': [
        { '@num': { value: 1 } },
        { '@string': d[0] } // But now, instead of typing in the sample name as a hardcoded string, we can access it from the data we passed in from <SampleName>.

        // Nearley wraps up anything matched by a rule inside an array, so we need to access our string from inside that array using d[0].

        // The result will depend on the contents of <SampleName>. heart[0] will output the string "heart" to send to the sound engine, click[0] will output "click", convol1[0] will output "convol1", and this will work for any tokens we add to the lexer.

        // We can now use as many samples as we like without having to repeat anything in our grammar.
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
#       'loop', [
#         semaIR.num(1),
#         semaIR.str(d[0])
#       ]
#     )}
#   }]
# %}


SampleName -> (%click | %convol1 | %heart) # We add a new expression to the grammar specifically to match the name of the sample. As in the previous tutorial, we provide all of the tokens in the lexer with | symbols between them as rules.
{% d => d[0][0].value %} # Whatever the token is, as long as it is present in the lexer, this function will return the name of its corresponding sample as a string.

# If the token is %click, the above JS will return "click", if it is %heart, it will return "heart", and so on.

# You can now scroll back to where you were.





# ---- RUNNING OUR LANGUAGE ---- #

 # As before, we can test our language by running these commands in the terminal:

   # nearleyc tut3.ne -o livelang.js
    # (compile)

   # nearley-test -i "<any of our tokens>" livelang.js
    # (test before building)

   # yarn build

   # yarn dev
    # (open a browser window and start SEMA)



# --- WHITESPACE HANDLING ---- #

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
