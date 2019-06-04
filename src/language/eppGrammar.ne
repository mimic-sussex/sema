# Builtins make your parser slower. For efficiency, use lexer like Moo
# functionkeyword: [, 'tri', 'square', 'pulse', 'noise', 'cososc', 'phasor', 'adsr', 'filter', 'samp'],
@{%
const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  osc:          ['osc',    '∞'],  // ∞ – Option–5
  sinosc:       ['sin',    '~'],  // ~ – Shift-`
  cososc:       ['cos',    '≈'],  // ≈ – Option–x
  triosc:       ['tri',    '∆'],  // ∆ – Option–j
  sawosc:       ['saw',    '◊'],  // ◊ – Shift-Option–v
  phasosc:      ['phasor', 'ø'],  // Ø – Option–o
  squareosc:    ['square', '∏'],  // ∏ – Shift-Option–p
  pulseosc:     ['pulse',  '^'],  // ^ – Shift–6
  gateosc:      ['gate',   '≠'],  // ≠ – Option–=
  patternosc:   ['patt',   '¶'],  // ¶ – Option–7
  bus:          ['bus',    '‡' ], // ‡ – Shift-Option–7
  wnoise:       ['wnoise', 'Ω'],  // Ω – Option–z
  pnoise:       ['pnoise'],
  bnoise:       ['bnoise'],
  tpb:          ['tpb'],
  import:       ['import'],
  declaration:  ['let'],
  functionkeyword: ['gain', 'adsr', 'dyn', 'dist', 'filter', 'delay', 'flang', 'chorus', 'samp', 'rev', 'conv', 'map'],
  map:          ['linlin', 'linexp', 'explin', 'expexp', 'linreg', 'class'],
  o:            /o/,
  x:            /x/,
  at:           /@/,
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
  dquote:       /\"/,
  squote:       /\'/,
  functionname: /[a-zA-Z][a-zA-Z0-9]*/,
  number:       /[-+]?[0-9]*\.?[0-9]+/,
  ws:   {match: /\s+/, lineBreaks: true}
});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

main -> ( _ Statement _ ):+                                   {% d => ({ "☺++" : d[1] })  %}

Statement -> Expressions                                      {% id %}
          | Declaration                                       {% id %}
          | Import                                            {% id %}
          | Comment                                           {% id %}

Declaration -> %let %functionname %dquote .:* %dquote         {% id %}

Import -> %import %lparen %functionname %rparen               {% id %}

Comment -> %hash .:* "\n"                                     {% d => ({ "☺comment": d[3] }) %}

Expressions ->
      Expression _ %semicolon _ Expressions                   {% d => [{ "☺spawn": d[0] }].concat(d[4]) %}
      | Expression ( _ %semicolon ):?                         {% d => [{ "☺spawn": d[0] }] %}

Expression ->
      Loop                                                    {% d => ({ "☺loop": d[0] }) %}
      | Beats                                                 {% d => ({ "☺beats": d[0] }) %}
      | Tempo                                                 {% id %}
      | Synth                                                 {% d => ({ "☺synth": d[0] }) %}

Tempo -> %tpb _ %number                                       {% d => ({ "☺tpb": parseInt(d[2]) }) %}

Beats -> Beat:+                                               {% d => [ d[0].join() ] %}

Beat ->
      Rest                                                    {% id %}
      | Hat                                                   {% id %}
      | Snare                                                 {% id %}
      | Kick                                                  {% id %}

Rest -> %dot                                                  {% id %}
Hat -> %hyphen                                                {% id %}
Snare -> %o                                                   {% id %}
Kick -> %x                                                    {% id %}

Loop -> "[" Beats "]"                                         {% d => ( d[1] ) %}

Synth ->
      SignalFunction _ %semicolon _ SignalFunctions;          {% d => ({ "@fx": d[0], "@func": d[4] }) %}
      | SignalFunction                                        {% d => ({ "@func": d[0] }) %}

SignalFunctions ->



# Composition Operators with Priorities {4,3,2,1,1} and Associativity {left, right, right, right, right }
Composition ->
            Recursive
            | Parallel
            | Sequential
            | Split
            | Merge

# Recursive ->
# Sequential ->
# Split ->
# Merge ->

SignalFunction ->
      Oscillator _         {% d => ({ "@comp": [d[0]].concat(d[4])}) %}
      | Oscillator _ Params _ %add _ Function                 {% d => [{ "@add": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}] %}
      | Oscillator _ Params _ %mult _ Function                {% d => [{ "@mul": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}] %}
      | Oscillator _ Params _ %hyphen _ Function              {% d => [{ "@sub": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}] %}
      | Oscillator _ Params _ %div _ Function                 {% d => [{ "@div": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}] %}
      | Oscillator _ Params                                   {% d => Object.assign({}, d[0], { param: d[2]}) %}



Oscillator ->  %osc _ OscillatorType %lbrack _ Params _ %rbrack
            |  %osc %lparen _ OscillatorType %comma Params _ %rparen

# OscillatorType is based on Maximilian's maxiOsc
OscillatorType -> Sinewave                                    {% d => ({ "@type": "@sin" }) %}
                | Coswave                                     {% d => ({ "@type": "@cos" }) %}
                | Phasor                                      {% d => ({ "@type": "@pha" }) %}
                | Saw                                         {% d => ({ "@type": "@saw" }) %}
                | Triangle                                    {% d => ({ "@type": "@tri" }) %}
                | Square                                      {% d => ({ "@type": "@square" }) %}
                | Pulse                                       {% d => ({ "@type": "@pulse" }) %}
                | Noise                                       {% id %}

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

Params ->
      null                                                    {% id %}
      | %number _ Params                                      {% d => return [parseFloat(d[0])].join(d[2])  %}


Effects -> %functionkeyword _ Params _ %colon _ Effects       {% d => [ Object.assign({}, {type:d[0].value} , { param: d[2]}) ].concat(d[6]) %}
        | %functionkeyword _ Params                           {% d => ( Object.assign({}, {type:d[0].value}, { param: d[2]} )) %}


# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
