
@{%
var semaIR = require('./semaIR.js');
console.log(semaIR);

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  click:         /click/,
  convol1:       /convol1/,
  heart:       /heart/,
  ws:           {match: /\s+/, lineBreaks: true},
});

%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
  SampleName
  {% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[semaIR.num(1),semaIR.str(d[0])]) }}] %}

SampleName -> (%click | %convol1 | %heart) {% d => d[0][0].value %}

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
