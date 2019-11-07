@{%
  // const moo = require("moo"); # NOTE: 'require' creates a node .js dependency, comment for  browser version 

  const lexer = moo.compile({
    separator:    /,/,
    paramEnd:     /}/,
    paramBegin:   /{/,
    variable:     /:[a-zA-Z0-9]+:/,
    sample:       { match: /\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
    oscAddress:   /(?:\/[a-zA-Z0-9]+)+/,
    number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
    semicolon:    /;/,
    funcName:     /[a-zA-Z][a-zA-Z0-9]*/,
    comment:      /\#[^\n]:*/, 
    ws:           {match: /\s+/, lineBreaks: true},
  });
%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
      Expression _ %semicolon _ Statement            {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      |
      Expression                                      {% d => [{"@sigOut": { "@spawn": d[0] }}] %}
      # | %hash . "\n"                                          {% d => ({ "@comment": d[3] }) %}

Expression ->
  ParameterList _ %funcName
  {% d => ({ "@synth": Object.assign(d[0],{"@jsfunc":d[2]})}) %}
  |
  ParameterList _ %sample
  {% d => {d[0]["@params"] = d[0]["@params"].concat([{"@string":d[2].value}]);
  return { "@synth": Object.assign(d[0],{"@jsfunc":{value:"sampler"}})}} %}
  |
  %oscAddress
  {% d => ({ "@synth": {"@params":[{"@string":d[0].value},{"@num":{value:-1}}], "@jsfunc":{value:"oscin"}}} ) %}
  |
  ParameterList _ %oscAddress
  {% d => ({ "@synth": {"@params":[{"@string":d[2].value},d[0]["@params"][0]], "@jsfunc":{value:"oscin"}}} ) %}
  |
  %variable _ Expression
  {% d => ({"@setvar": {"@varname":d[0],"@varvalue":d[2]}} ) %}
  |
  %comment {% id %}

ParameterList ->
  %paramBegin Params  %paramEnd
  {% d => ({"paramBegin":d[0], "@params":d[1], "paramEnd":d[2]} ) %}


Params ->
  ParamElement                                                   {% (d) => ([d[0]]) %}
  |
  ParamElement _ %separator _ Params                             {% d => [d[0]].concat(d[4]) %}

ParamElement ->
  %number                                                     {% (d) => ({"@num":d[0]}) %}
  |
  Expression                                                  {% id %}
  |
  %variable                                                   {% (d) => ({"@getvar":d[0]}) %}
  |
  %paramBegin Params  %paramEnd                               {%(d) => ({"@list":d[1]})%}




# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
