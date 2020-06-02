
@{%

const lexer = moo.compile({
  separator:       /,/,
  paramEnd:      />/,
  paramBegin:   /</,
  variable:          /![a-zA-Z0-9]+!/,
  sample:           { match: /\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  stretch:           { match: /\@[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  oscAddress:   /(?:\/[a-zA-Z0-9]+)+/,
  number:          /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  semicolon:      /;/,
  funcName:      /[a-zA-Z][a-zA-Z0-9]*/,
  comment:       /#[^\n]*/,
  ws:                   { match: /\s+/, lineBreaks: true},
});

%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{% d => ( { '@lang' : d[1] } )  %}

Statement ->
  Expression _ %semicolon _ Statement
  {% d => [ { '@spawn': d[0] } ].concat(d[4]) %}
  |
  Expression
  {% d => [ { '@sigOut': { '@spawn': d[0] }} ] %}
  # |
  # %hash . '\n'
  #{% d => ( { '@comment': d[3] } ) %}

Expression ->
  ParameterList _ %funcName
  {% d => sema.synth( d[2].value, d[0]['@params'] ) %}
  |
  ParameterList _ %sample
  {% d => sema.synth( 'sampler', d[0]['@params'].concat( [ sema.str( d[2].value ) ] ) ) %}
  |
  ParameterList _ %stretch
  {% d => sema.synth( 'stretch', d[0]['@params'].concat( [ sema.str( d[2].value ) ] ) ) %}
  |
  %oscAddress
  {% d => sema.synth( 'oscin', [ sema.str( d[0].value ), sema.num(-1) ] ) %}
  |
  ParameterList _ %oscAddress
  {% d => sema.synth( 'oscin', [ sema.str( d[2].value ), d[0]['@params'][0] ] ) %}
  |
  %variable _ Expression
  {% d => sema.setvar( d[0], d[2] ) %}
  |
  %comment {% id %}

ParameterList ->
  %paramBegin Params %paramEnd
  {% d => ( { 'paramBegin': d[0], '@params': d[1], 'paramEnd': d[2] } ) %}


Params ->
  ParamElement
  {% d => ( [ d[0] ] ) %}
  |
  ParamElement _ %separator _ Params
  {% d => [ d[0] ].concat(d[4]) %}

ParamElement ->
  %number
  {% d => ( { '@num': d[0] } ) %}
  |
  Expression
  {% id %}
  |
  %variable
  {% d => sema.getvar( d[0] ) %}
  |
  %paramBegin Params  %paramEnd
  {% d => ( { '@list': d[1] } )%}

# Whitespace

_  -> wschar:*
{% function(d) {return null;} %}

__ -> wschar:+
{% function(d) {return null;} %}