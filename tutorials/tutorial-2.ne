@{%
const lexer = moo.compile({
  click:      /click/,
  convol1:    /convol1/,
  heart:      /heart/,
  separator:  />/,
  number:     /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  ws:         {match: /\s+/, lineBreaks: true},
});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         
{% d => ({ "@lang" : d[1] })  %}

Statement ->
  SampleName %separator %number
  {% d => [{
      "@sigOut": {
        "@spawn": sema.synth('loop', [sema.num(d[2].value), sema.str(d[0])])
      }
    }]
  %}

SampleName -> (%click | %convol1 | %heart) 
{% d => d[0][0].value %}

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}