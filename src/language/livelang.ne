@{%
const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  separator:    /,/,
  paramEnd:     /}/,
  paramBegin:   /{/,
  lparens:      /\(/,
  rparens:      /\)/,
  variable:     /:[a-zA-Z0-9]+:/,
  sample:       { match: /\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},
  oscAddress:   /(?:\/[a-zA-Z0-9]+)+/,
  number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  //integer:      { match: /[1-9][0-9]+/, lineBreaks: false, value: x => x.join('')},
  integer:      /[1-9][0-9]+\b/,
  test:         /[4]/,
  semicolon:    /;/,
  funcName:     /[a-zA-Z][a-zA-Z0-9]*/,
  ws:           {match: /\s+/, lineBreaks: true},
});
%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Metastatement _                                         {% d => ({ "@lang" : d[1] })  %}

Metastatement -> Statement                          {% id %}
      | Loop                                        {% id %}

Statement ->
      Expression _ %semicolon _ Statement            {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      |
      Expression                                      {% d => [{"@sigOut": { "@spawn": d[0] }}] %}
      # | %hash . "\n"                                          {% d => ({ "@comment": d[3] }) %}

# loop
Parens -> %lparens _ Metastatement _ %rparens 
{% d => d[2] %}

# Loop -> "do" _ %integer _ %lparens _ Metastatement _ %rparens _
#Loop -> "do" _ %integer _ Parens _
Loop -> "do" _ Int _ Parens _
{%
  d => {
    let looped = [];
    const loopCount = parseInt(d[2]);
    for (let i=0; i<loopCount; i++)
    {
      looped = looped.concat(d[4]);
    }
    return looped;
  }
%}

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

Int -> [1-9]:+

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
