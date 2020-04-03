
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%

/*
Examples:

Saw wave:

{100}saw

State variable filter:

:speed:{{1}pha,100,500}uexp;
{{100}saw,:speed:, 5, 0,1,0,0}svf

Sequencing with idx and lists:

 - grabbing a single fixed element
:x:{{10}imp,0,<200,400,600,1000>}idx;
{:x:}saw

:x:{{10}imp,{4}pha,<200,400,600,1000>}idx;
{:x:}saw

Lists with variable elements:
:x:{{10}imp,{4}pha,<200,400,600,{{{0.1}sin}abs,100}mul>}idx;
{:x:}saw

:x:{{10}imp,{0.4}pha,<{{{0.15}sin}abs,300}mul,{{{0.1}sin}abs,100}mul>}idx;
{:x:}sawn

*/


const lexer = moo.compile({
  separator:      /,/,
  paramEnd:       /}/,
  paramBegin:     /{/,
  listEnd:        /\>/,
  listBegin:      /\</,
  variable:       /:[a-zA-Z0-9]+:/,
	string:					{match: /'[a-zA-Z0-9]+'/, value: x=>x.slice(1,x.length-1)},
  sample:         { match: /\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  slice:          { match: /\|[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  stretch:        { match: /\@[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  number:         /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
  semicolon:      /;/,
  funcName:       /[a-zA-Z][a-zA-Z0-9]*/,
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
  Expression _ %semicolon _ Statement
  {% d => [ { '@spawn': d[0] } ].concat(d[4]) %}
  |
  Expression
  {% d => [ { '@sigOut': { '@spawn': d[0] }} ] %}
	|
	%comment _ Statement
	{% d => d[2] %}


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
  {% d => sema.setvar( d[0], d[2] ) %}

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
	%string
  {% d => ( { '@str': d[0] } ) %}
  |
  Expression
  {% id %}
  |
  %variable
  {% d => sema.getvar( d[0] ) %}
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
