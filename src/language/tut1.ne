
@{%
var semaIR = require('./semaIR.js');
console.log(semaIR);

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  click:        /click/,
  ws:           {match: /\s+/, lineBreaks: true},
});

%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _ {% function(d) { console.log(d); } %}                                         
      {% d => ({ "@lang" : d[1] })  %}

Statement ->
      %click {% function(d) { return d; } %} 
      {% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[  
                                                            semaIR.num(1),
                                                            semaIR.str('click')
                                                            ]
                                                    )
                            }
                }
              ] 
      %}


# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
