# lang:
# 16∑denom  -- now all integers are divided by 16.  can run this locally or globally
# (10,(10)ml)saw
# Builtins make your parser slower. For efficiency, use lexer like Moo
# functionkeyword: [, 'tri', 'square', 'pulse', 'noise', 'cososc', 'phasor', 'adsr', 'filter', 'samp'],
@{%
const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  separator:      /,/,
  paramEnd:       /}/,
  paramBegin:     /{/,
  oscAddress:     /(?:\/[a-zA-Z0-9]+)+/,
  sample:         /(?:\\[a-zA-Z0-9]+)+/,
  add:            /\+/,
  mult:           /\*/,
  div:            /\//,
  dot:            /\./,
  hash:           /\#/,
  hyphen:         /\-/,
  ndash:          /\–/,
  mdash:          /\—/,
  comma:          /\,/,
  colon:          /\:/,
  semicolon:      /\;/,
  split:          /\<:/,
  merge:          /\:>/,
  tilde:          /\~/,
  funcName:       /[a-zA-Z][a-zA-Z0-9]*/,
  number:         /[-+]?[0-9]*\.?[0-9]+/,
  ws:             {match: /\s+/, lineBreaks: true},
});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                             {% d => ( { "@lang": d[1] } )  %}

Statement ->
      Expression _ %semicolon _ Statement                         {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      | Expression ( _ %semicolon ):?                             {% d => [{ "@spawn": d[0] }] %}
      | %hash . "\n"                                              {% d => ( { "@comment": d[3] } ) %}

Expression ->
      %paramBegin Params %paramEnd %funcName                      {% d => ( { "@synth": { "@params":d[1], "@jsfunc":d[3], "paramBegin":d[0], "paramEnd":d[2]}} ) %}
      |
      %paramBegin Params %paramEnd %sample                        {% d => ( { "@sample": { "@params":d[1], "@filename":d[3]} })  %}
      |
      %paramBegin Params %paramEnd %oscAddress                    {% d => ( { "@oscreceiver": { "@params":d[1], "@oscaddr":d[3], "paramBegin":d[0], "paramEnd":d[2]} } ) %}
      |
      %oscAddress                                                 {% d => ( { "@oscreceiver": { "@params":{}, "@oscaddr":d[0]} } ) %}

      # | %funcName                                               {% d => ({ "@synth": [], "@jsfunc":d[0]} ) %}

Params ->
      (%number)                                                   {% d => ([ { "@num":d[0][0]}] ) %}
      |
      %number %separator Params                                   {% d => ([ { "@num": d[0]}].concat(d[2]) ) %}
      |
      Expression                                                  {% d => ([ { "@num":d[0]}]) %}     
      # Expression                                                  {% d => ([ d[0] ]) %}     
      |
      Expression %separator Params                                {% d => ([ { "@num": d[0]}].concat(d[2]) ) %}
      # Expression %separator Params                                {% d => ([ d[0] ].concat(d[2]) ) %}
      |
      %paramBegin Params %paramEnd                                {% d => ([ { "@list":d[1]} ]) %}
      |
      %paramBegin Params %paramEnd %separator Params              {% d => ([ { "@list":d[1]} ].concat(d[4]) ) %}




  # | Expression %separator Params                    {% d => [{ "@num": d[0]}].concat(d[2]) %}
  # | %funcName %separator Params       {% d => ([{ "@jsfunc": d[0]}].concat(d[2])) %}


# Synth ->
#       Function                                              {% d => ({ "@func": d[0] }) %}
#
#
# Function ->
#   OscFunc _ %add _ Function                                    {% d => [{ "@add": [ Object.assign({}, d[0]) ].concat(d[4])}] %}
#   | OscFunc
#
# OscFunc ->
#       Oscillator _ %lparen _ Function _ %rparen               {% d => ({ "@comp": [d[0]].concat(d[4])}) %}
#       | Oscillator _ Params                                   {% d => Object.assign({}, d[0], { param: d[2]}) %}
#       # | Oscillator _ Params _ %add _ OscFunc                   {% d => [{ "@add": [ Object.assign({}, d[0]) ].concat(d[6])}] %}
#
#
# Oscillator ->
#     %osc _ Sinewave                                           {% d => ({ "@osc": "@sin" }) %}
#     | %osc _ Coswave                                          {% d => ({ "@osc": "@cos" }) %}
#     | %osc _ Phasor                                           {% d => ({ "@osc": "@pha" }) %}
#     | %osc _ Saw                                              {% d => ({ "@osc": "@saw" }) %}
#     | %osc _ Triangle                                         {% d => ({ "@osc": "@tri" }) %}
#     | %osc _ Square                                           {% d => ({ "@osc": "@square" }) %}
#     | %osc _ Pulse                                            {% d => ({ "@osc": "@pulse" }) %}
#     | %osc _ Noise                                            {% id %}
#
# Sinewave -> %sinosc                                           {% id %}
# Coswave -> %cososc                                            {% id %}
# Phasor -> %phasosc                                            {% id %}
# Saw -> %sawosc                                                {% id %}
# Triangle -> %triosc                                           {% id %}
# Square -> %squareosc                                          {% id %}
# Pulse -> %pulseosc                                            {% id %}



# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
