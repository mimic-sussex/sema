
# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
  const lexer = moo.compile({
    separator:      /,/,
    paramEnd:       /}/,
    paramBegin:     /{/,
    listEnd:        /\>/,
    listBegin:      /\</,
    variable:       /:[a-zA-Z0-9]+:/,
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


Statement ->
	%comment
	|
	%comment _ Statement
  |
  Expression _ %semicolon _ Statement
  |
  Expression

Expression ->
  ParameterList _ %funcName
  |
  ParameterList _ %sample
  |
  ParameterList _ %slice
  |
  ParameterList _ %stretch
  |
  %variable _ Expression
  |
  %comment 

ParameterList ->
  %paramBegin Params %paramEnd

Params ->
  ParamElement
  |
  ParamElement _ %separator _ Params


ParamElement ->
  %number
  |
  Expression
  |
  %variable
  |
  %listBegin Params  %listEnd


# Whitespace

_  -> wschar:*

__ -> wschar:+

wschar -> %ws
