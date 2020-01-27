# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
const lexer = moo.compile({
  click:      /click/,    // match the string 'click'
  convol1:    /convol1/,  // match the string 'convol1'
  heart:      /heart/,    // match the string 'heart'
  separator:  />/,        // match the string '>'        
  number:     /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/, // match decimal number 
  ws:         {match: /\s+/, lineBreaks: true}, // match white space
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