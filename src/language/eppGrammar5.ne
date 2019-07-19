# now with variables

#  number:       /[-+]?[0-9]*\.?[0-9]+/,

@{%
const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  separator:    /,/,
  paramEnd:     /}/,
  paramBegin:   /{/,
  variable:     /:[a-zA-Z0-9]+:/,
  oscAddress:   /(?:\/[a-zA-Z0-9]+)+/,
  sample:       /\\[a-zA-Z0-9]+/,
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
  ws:   {match: /\s+/, lineBreaks: true},
});
%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
      Expression _ (%semicolon | "\n") _ Statement            {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      |
      Expression                                              {% d => [{ "@spawn": d[0] }] %}
      # | %hash . "\n"                                          {% d => ({ "@comment": d[3] }) %}

Expression ->
%variable %paramBegin Params  %paramEnd  %funcName            {% d => ({"@setvar": {"@varname":d[0],"@varvalue":{ "@synth": {"@params":d[2], "@jsfunc":d[4], "paramBegin":d[1], "paramEnd":d[3]}}}} ) %}
|
%paramBegin Params  %paramEnd  %funcName                      {% d => ({"@setvar": {"@varname":":default:","@varvalue":{ "@synth": {"@params":d[1], "@jsfunc":d[3], "paramBegin":d[0], "paramEnd":d[2]}}}} ) %}
# |
# %paramBegin Params  %paramEnd  %oscAddress                  {% d => ({ "@synth": {"paramBegin":d[0], "paramEnd":d[2], "@params":[{"@string":d[3].value},d[1][0]], "@jsfunc":{value:"oscin"}}} ) %}       {% d => ({ "@oscreceiver": {"@params":d[1], "@oscaddr":d[3], "paramBegin":d[0], "paramEnd":d[2]}} ) %}
|
%paramBegin Params %paramEnd %sample                          {% d => ({ "@synth": {"@params":[{"@string":d[3].value}].concat(d[1]), "@jsfunc":{value:"sampler"}, "paramBegin":d[0], "paramEnd":d[2]}} ) %}
|
%oscAddress                                                   {% d => ({ "@synth": {"@params":[{"@string":d[0].value},{"@num":{value:-1}}], "@jsfunc":{value:"oscin"}}} ) %}

      # | %funcName                                              {% d => ({ "@synth": [], "@jsfunc":d[0]} ) %}

Params ->
  # (%number)                                                   {% (d) => ([{"@num":d[0][0]}]) %}
  (%number)                                                   {% function(d) { console.log("nearly: " + d ); return [ {"@num":d[0][0]} ]; }  %}
  |
  Expression                                                  {% (d) => ([{"@num":d[0]}]) %}
  |
  %number %separator Params                                   {% d => [{ "@num": d[0]}].concat(d[2]) %}
  |
  # %oscAddress %separator Params                             {% d => [{ "@oscaddr": d[0]}].concat(d[2]) %}
  # |
  Expression %separator Params                                {% d => [{ "@num": d[0]}].concat(d[2]) %}
  |
  %paramBegin Params  %paramEnd                               {%(d) => ([{"@list":d[1]}])%}
  |
  %paramBegin Params  %paramEnd  %separator Params            {% d => [{ "@list": d[1]}].concat(d[4]) %}

  # | Expression %separator Params                    {% d => [{ "@num": d[0]}].concat(d[2]) %}
  # | %funcName %separator Params       {% d => ([{ "@jsfunc": d[0]}].concat(d[2])) %}




# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
