# GRAMMAR EDITOR

# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%

const lexer = moo.compile({
  separator:      /,/,
  paramEnd:       /}/,
  paramBegin:     /{/,
  listEnd:        /\]/,
  listBegin:      /\[/,
  dacoutCh:       /\>[0-9]+/,
  dacout:         /\>/,
  variable:       /:[a-zA-Z0-9]+:/,
  sample:         { match: /\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  slice:          { match: /\|[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  stretch:        { match: /\@[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  clockTrig:      /0t-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
	number:         /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
  semicolon:      /;/,
  funcName:       /[a-zA-Z][a-zA-Z0-9]*/,
	string:					{ match: /'[a-zA-Z0-9]+'/, value: x => x.slice(1,x.length-1)},
  comment:        /\/\/[^\n]*/,
  ws:             { match: /\s+/, lineBreaks: true},
});

%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _
{% d => ( { '@lang' : d[1] } )  %}

Statement ->
  %comment _ Statement
  {% d => d[2] %}
	|
  Expression _ %semicolon _ Statement
  {% d => [ { '@spawn': d[0] } ].concat(d[4]) %}
  |
  Expression _ %semicolon (_ %comment):*
  {% d => [ { '@spawn': d[0] } ] %}


Expression ->
  ParameterList _ %funcName
  {% d => sema.synth( d[2].value, d[0]['@params'] ) %}
  |
  ParameterList _ %sample
  {% d => sema.synth( 'sampler', d[0]['@params'].concat( [ sema.str( d[2].value ) ] ) ) %}
  |
  ParameterList _ %slice
  {% d => sema.synth( 'slice', d[0]['@params'].concat( [ sema.str( d[2].value ) ] ) ) %}
  |
  ParameterList _ %stretch
  {% d => sema.synth( 'stretch', d[0]['@params'].concat( [ sema.str( d[2].value ) ] ) ) %}
  |
  %variable _ Expression
  {% d => sema.setvar( d[0].value, d[2] ) %}
  |
  %dacout _ Expression
  {% d => sema.synth( 'dac', [d[2]] ) %}
  |
  %dacoutCh _ Expression
  {% d => sema.synth( 'dac', [d[2], sema.num(d[0].value.substr(1))] ) %}

ParameterList ->
  %paramBegin Params %paramEnd
  {% d => ( { 'paramBegin': d[0], '@params': d[1], 'paramEnd': d[2] } ) %}
	|
	%paramBegin _ %paramEnd
  {% d => ( { 'paramBegin': d[0], '@params': [], 'paramEnd': d[2] } ) %}


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
	%string
  {% d => ( { '@string': d[0].value } ) %}
  |
  Expression
  {% id %}
  |
  %variable
  {% d => sema.getvar( d[0].value ) %}
  |
  %listBegin Params  %listEnd
  {% d => ( { '@list': d[1] } )%}


# Whitespace

_  -> wschar:*
{% function(d) {return null;} %}

__ -> wschar:+
{% function(d) {return null;} %}

wschar -> %ws
{% id %}
