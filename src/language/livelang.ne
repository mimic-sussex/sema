#  number:       /[-+]?[0-9]*\.?[0-9]+/,
#

@{%
const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  separator:    /,/,
  paramEnd:     /}/,
  paramBegin:   /{/,
  variable:     /:[a-zA-Z0-9]+:/,
  sample:       { match: /\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(0, x.length)},
  oscAddress:   /(?:\/[a-zA-Z0-9]+)+/,
  number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  add:          /\+/,
  mult:         /\*/,
  div:          /\//,
  dot:          /\./,
  hash:         /\#/,
  hyphen:       /\-/,
  ndash:        /\–/,
  mdash:        /\—/,
  comma:        /\,/,
  colon:        /\:/,
  semicolon:    /\;/,
  funcName:     /[a-zA-Z][a-zA-Z0-9]*/,
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
%variable %paramBegin Params  %paramEnd  %funcName            {% d => ({"@setvar": {"@varname":d[0],"@varvalue":{ "@synth": {"@params":d[2], "@jsfunc":d[4], "paramBegin":d[1], "paramEnd":d[3]}}}} ) %}
|
%paramBegin Params  %paramEnd  %funcName                      {% d => ({ "@synth": {"@params":d[1], "@jsfunc":d[3], "paramBegin":d[0], "paramEnd":d[2]}} ) %}
# |
# %paramBegin Params  %paramEnd  %oscAddress                  {% d => ({ "@synth": {"paramBegin":d[0], "paramEnd":d[2], "@params":[{"@string":d[3].value},d[1][0]], "@jsfunc":{value:"oscin"}}} ) %}       {% d => ({ "@oscreceiver": {"@params":d[1], "@oscaddr":d[3], "paramBegin":d[0], "paramEnd":d[2]}} ) %}
|
# %paramBegin Params %paramEnd %sample                          {% d => ({ "@synth": {"@params":[{"@string":d[3].value.substr(1)}].concat(d[1]), "@jsfunc":{value:"sampler"}, "paramBegin":d[0], "paramEnd":d[2]}} ) %}
%paramBegin Params %paramEnd %sample                          {% d => ({ "@synth": {"@params":[{"@string":d[3].value.substr(1)}].concat(d[1]), "@jsfunc":{value:"sampler"}, "paramBegin":d[0], "paramEnd":d[2]}} ) %}
|
# %paramBegin Params %paramEnd %sample                          {% d => ({ "@synth": {"@params":[{"@string":d[3].value.substr(1)}].concat(d[1]), "@jsfunc":{value:"sampler"}, "paramBegin":d[0], "paramEnd":d[2]}} ) %}
%variable %paramBegin Params %paramEnd %sample                          {% d => ({"@setvar": {"@varname":d[0],"@varvalue":{ "@synth": {"@params":[{"@string":d[4].value.substr(1)}].concat(d[2]), "@jsfunc":{value:"sampler"}, "paramBegin":d[1], "paramEnd":d[3]}}}} ) %}
|
%oscAddress                                                   {% d => ({ "@synth": {"@params":[{"@string":d[0].value},{"@num":{value:-1}}], "@jsfunc":{value:"oscin"}}} ) %}

      # | %funcName                                              {% d => ({ "@synth": [], "@jsfunc":d[0]} ) %}

Params ->
  ParamElement                                                   {% (d) => ([d[0]]) %}
  |
  ParamElement %separator Params                                   {% d => [d[0]].concat(d[2]) %}

ParamElement ->
  %number                                                   {% (d) => ({"@num":d[0]}) %}
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
