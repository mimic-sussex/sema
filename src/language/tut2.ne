
@{%
var semaIR = require('./semaIR.js');
console.log(semaIR);

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  click:        /click/,
  convol1:      /convol1/,
  heart:        /heart/,
  ws:           {match: /\s+/, lineBreaks: true},
});

%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
%click
{% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[semaIR.num(1),semaIR.str('click')]) }}] %}
|
%convol1
{% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[semaIR.num(1),semaIR.str('convol1')]) }}] %}
|
%heart
{% d => [{"@sigOut": { "@spawn": semaIR.synth('loop',[semaIR.num(1),semaIR.str('heart')]) }}] %}


# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
