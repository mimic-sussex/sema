# Builtins make your parser slower. For efficiency, use lexer like Moo
# functionkeyword: [, 'tri', 'square', 'pulse', 'noise', 'cososc', 'phasor', 'adsr', 'filter', 'samp'],
@{%
const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  oscMsg:       ['oscIn'],
  mlModel:       ['mlmodel'],
  osc:          ['osc',    '∞'],
  sinosc:       ['sin',    '~'],
  cososc:       ['cos',    '≈'],
  triosc:       ['tri',    '∆'],
  sawosc:       ['saw',    '◊'],
  phasosc:      ['phasor', 'Ø'],
  squareosc:    ['square', '∏'],
  pulseosc:     ['pulse',  '^'],
  gateosc:      ['gate',   '≠'],
  patternosc:   ['patt',   '¶'],
  bus:          ['bus',    '‡' ],
  wnoise:       ['wnoise', 'Ω'],
  pnoise:       ['pnoise'],
  bnoise:       ['bnoise'],
  tpb:          ['tpb'],
  functionkeyword: ['gain', 'adsr', 'dyn', 'dist', 'filter', 'delay', 'flang', 'chorus', 'samp', 'rev', 'conv', 'map'],
  map:          ['linlin', 'linexp', 'explin', 'expexp', 'linreg', 'class'],
  o:            /o/,
  x:            /x/,
  at:           /@/,
  oscAddress:   /\/[a-zA-Z0-9]+/,
  lparen:       /\(/,
  rparen:       /\)/,
  lbrack:       /\[/,
  rbrack:       /\]/,
  pipe:         /\|/,
  add:          /\+/,
  mult:         /\*/,
  div:          /\//,
  dot:          /\./,
  assign:       /\->/,
  bindr:        /\>>/,
  bindl:        /\<</,
  ampmore:      /\(\(/,
  ampless:      /\)\)/,
  silence:      /\!/,
  transpmore:   /\+/,
  underscore:   /\_/,
  hash:         /\#/,
  hyphen:       /\-/,
  ndash:        /\–/,
  mdash:        /\—/,
  comma:        /\,/,
  colon:        /\:/,
  semicolon:    /\;/,
  split:        /\<:/,
  merge:        /\:>/,
  tilde:        /\~/,
  functionname: /[a-zA-Z][a-zA-Z0-9]*/,
  number:       /[-+]?[0-9]*\.?[0-9]+/,
  ws:   {match: /\s+/, lineBreaks: true},
});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
      Expression _ %semicolon _ Statement                     {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      | Expression ( _ %semicolon ):?                         {% d => [{ "@spawn": d[0] }] %}
      | %hash . "\n"                                          {% d => ({ "@comment": d[3] }) %}

Expression ->
      Synth                                                 {% d => ({ "@synth": d[0] }) %}


Synth ->
      Function                                              {% d => ({ "@func": d[0] }) %}


Function ->
  OscFunc _ %add _ Function                                    {% d => [{ "@add": [ Object.assign({}, d[0]) ].concat(d[4])}] %}
  | IOFunc _ %add _ Function                                    {% d => [{ "@add": [ Object.assign({}, d[0]) ].concat(d[4])}] %}
  | OscFunc
  | IOFunc

IOFunc ->
  Transducer                                                  {% d => ({"@io": d[0]}) %}

OscFunc ->
      Oscillator _ %lparen _ Function _ %rparen               {% d => ({ "@comp": [d[0]].concat(d[4])}) %}
      | Oscillator _ Params                                   {% d => Object.assign({}, d[0], { param: d[2]}) %}
      # | Oscillator _ Params _ %add _ OscFunc                   {% d => [{ "@add": [ Object.assign({}, d[0]) ].concat(d[6])}] %}

Transducer ->
  %oscMsg _ %oscAddress                                        {% d => ({"@OSCMsg": {addr: d[2].value}}) %}
  | %mlModel _ %number                                           {% d => ({"@MLModel": {input: d[2].value}}) %}


Oscillator ->
    %osc _ Sinewave                                           {% d => ({ "@osc": "@sin" }) %}
    | %osc _ Coswave                                          {% d => ({ "@osc": "@cos" }) %}
    | %osc _ Phasor                                           {% d => ({ "@osc": "@pha" }) %}
    | %osc _ Saw                                              {% d => ({ "@osc": "@saw" }) %}
    | %osc _ Triangle                                         {% d => ({ "@osc": "@tri" }) %}
    | %osc _ Square                                           {% d => ({ "@osc": "@square" }) %}
    | %osc _ Pulse                                            {% d => ({ "@osc": "@pulse" }) %}
    | %osc _ Noise                                            {% id %}

Sinewave -> %sinosc                                           {% id %}
Coswave -> %cososc                                            {% id %}
Phasor -> %phasosc                                            {% id %}
Saw -> %sawosc                                                {% id %}
Triangle -> %triosc                                           {% id %}
Square -> %squareosc                                          {% id %}
Pulse -> %pulseosc                                            {% id %}

Noise -> %wnoise                                              {% d => [{ "@wnoise" : d[0] }] %}
      |  %pnoise                                              {% d => [{ "@pnoise" : d[0] }] %}
      |  %bnoise                                              {% d => [{ "@bnoise" : d[0] }] %}

Params -> %lbrack _ %number:+ _ %rbrack                       {% d => console.log(d[2])  %}
      | %number                                               {% d => parseInt(d[0]) %}

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
