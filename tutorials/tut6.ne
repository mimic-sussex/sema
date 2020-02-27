
@{%
var semaIR = require('./semaIR.js');
console.log(semaIR);

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  click:         /click/,
  convol1:       /convol1/,
  heart:       /heart/,
  insec3:       /insec3/,
  paper:       /paper/,
  separator:  />/,
  number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  ws:           {match: /\s+/, lineBreaks: true},
});

%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _
{% d =>
  ({ "@lang" :
  [{"@sigOut": { "@spawn":semaIR.synth('mix',d[1])}}]
  })

%}

Statement ->
  SampleAndSpeed _ Statement
  {% d => d[2].concat(d[0]) %}
  |
  SampleAndSpeed
  {% d=>d %}


SampleAndSpeed ->
  SampleName %separator %number
  {% d =>
      semaIR.synth('loop',[semaIR.num(d[2].value),semaIR.str(d[0])])
  %}

SampleName -> (%click | %convol1 | %heart | %insec3 | %paper) {% d => d[0][0].value %}

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
