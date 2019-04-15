// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

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
  functionname: /[a-zA-Z][a-zA-Z0-9]*/,
  number:       /[-+]?[0-9]*\.?[0-9]+/,
  ws:   {match: /\s+/, lineBreaks: true}
});
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "Statement", "_"], "postprocess": d => ({ "@lang" : d[1] })},
    {"name": "Statement", "symbols": ["Expression", "_", (lexer.has("semicolon") ? {type: "semicolon"} : semicolon), "_", "Statement"], "postprocess": d => [{ "@spawn": d[0] }].concat(d[4])},
    {"name": "Statement$ebnf$1$subexpression$1", "symbols": ["_", (lexer.has("semicolon") ? {type: "semicolon"} : semicolon)]},
    {"name": "Statement$ebnf$1", "symbols": ["Statement$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "Statement$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "Statement", "symbols": ["Expression", "Statement$ebnf$1"], "postprocess": d => [{ "@spawn": d[0] }]},
    {"name": "Statement", "symbols": [(lexer.has("hash") ? {type: "hash"} : hash), /./, {"literal":"\n"}], "postprocess": d => ({ "@comment": d[3] })},
    {"name": "Expression", "symbols": ["Loop"], "postprocess": d => ({ "@loop": d[0] })},
    {"name": "Expression", "symbols": ["Beats"], "postprocess": d => ({ "@beats": d[0] })},
    {"name": "Expression", "symbols": ["Synth"], "postprocess": d => ({ "@synth": d[0] })},
    {"name": "Expression", "symbols": ["Tempo"], "postprocess": id},
    {"name": "Tempo", "symbols": [(lexer.has("tpb") ? {type: "tpb"} : tpb), "_", (lexer.has("number") ? {type: "number"} : number)], "postprocess": d => ({ "@tpb": parseInt(d[2]) })},
    {"name": "Loop", "symbols": [{"literal":"["}, "Beats", {"literal":"]"}], "postprocess": d => ( d[1] )},
    {"name": "Beats$ebnf$1", "symbols": ["Beat"]},
    {"name": "Beats$ebnf$1", "symbols": ["Beats$ebnf$1", "Beat"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Beats", "symbols": ["Beats$ebnf$1"], "postprocess": d => [ d[0].join() ]},
    {"name": "Beat", "symbols": ["Rest"], "postprocess": id},
    {"name": "Beat", "symbols": ["Hat"], "postprocess": id},
    {"name": "Beat", "symbols": ["Snare"], "postprocess": id},
    {"name": "Beat", "symbols": ["Kick"], "postprocess": id},
    {"name": "Rest", "symbols": [(lexer.has("dot") ? {type: "dot"} : dot)], "postprocess": id},
    {"name": "Hat", "symbols": [(lexer.has("hyphen") ? {type: "hyphen"} : hyphen)], "postprocess": id},
    {"name": "Snare", "symbols": [(lexer.has("o") ? {type: "o"} : o)], "postprocess": id},
    {"name": "Kick", "symbols": [(lexer.has("x") ? {type: "x"} : x)], "postprocess": id},
    {"name": "Synth", "symbols": ["Effects", "_", (lexer.has("colon") ? {type: "colon"} : colon), "_", "Function"], "postprocess": d => ({ "@fx": d[0], "@func": d[4] })},
    {"name": "Synth", "symbols": ["Function"], "postprocess": d => ({ "@func": d[0] })},
    {"name": "Effects", "symbols": [(lexer.has("functionkeyword") ? {type: "functionkeyword"} : functionkeyword), "_", "Params", "_", (lexer.has("colon") ? {type: "colon"} : colon), "_", "Effects"], "postprocess": d => [ Object.assign({}, {type:d[0].value} , { param: d[2]}) ].concat(d[6])},
    {"name": "Effects", "symbols": [(lexer.has("functionkeyword") ? {type: "functionkeyword"} : functionkeyword), "_", "Params"], "postprocess": d => ( Object.assign({}, {type:d[0].value}, { param: d[2]} ))},
    {"name": "Function", "symbols": ["Oscillator", "_", (lexer.has("lparen") ? {type: "lparen"} : lparen), "_", "Function", "_", (lexer.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": d => ({ "@comp": [d[0]].concat(d[4])})},
    {"name": "Function", "symbols": ["Oscillator", "_", "Params", "_", (lexer.has("add") ? {type: "add"} : add), "_", "Function"], "postprocess": d => [{ "@add": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}]},
    {"name": "Function", "symbols": ["Oscillator", "_", "Params", "_", (lexer.has("mult") ? {type: "mult"} : mult), "_", "Function"], "postprocess": d => [{ "@mul": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}]},
    {"name": "Function", "symbols": ["Oscillator", "_", "Params", "_", (lexer.has("hyphen") ? {type: "hyphen"} : hyphen), "_", "Function"], "postprocess": d => [{ "@sub": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}]},
    {"name": "Function", "symbols": ["Oscillator", "_", "Params", "_", (lexer.has("div") ? {type: "div"} : div), "_", "Function"], "postprocess": d => [{ "@div": [ Object.assign({}, d[0], { param: d[2]}) ].concat(d[6])}]},
    {"name": "Function", "symbols": ["Oscillator", "_", "Params"], "postprocess": d => Object.assign({}, d[0], { param: d[2]})},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Sinewave"], "postprocess": d => ({ "@osc": "@sin" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Coswave"], "postprocess": d => ({ "@osc": "@cos" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Phasor"], "postprocess": d => ({ "@osc": "@pha" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Saw"], "postprocess": d => ({ "@osc": "@saw" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Triangle"], "postprocess": d => ({ "@osc": "@tri" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Square"], "postprocess": d => ({ "@osc": "@square" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Pulse"], "postprocess": d => ({ "@osc": "@pulse" })},
    {"name": "Oscillator", "symbols": [(lexer.has("osc") ? {type: "osc"} : osc), "_", "Noise"], "postprocess": id},
    {"name": "Sinewave", "symbols": [(lexer.has("sinosc") ? {type: "sinosc"} : sinosc)], "postprocess": id},
    {"name": "Coswave", "symbols": [(lexer.has("cososc") ? {type: "cososc"} : cososc)], "postprocess": id},
    {"name": "Phasor", "symbols": [(lexer.has("phasosc") ? {type: "phasosc"} : phasosc)], "postprocess": id},
    {"name": "Saw", "symbols": [(lexer.has("sawosc") ? {type: "sawosc"} : sawosc)], "postprocess": id},
    {"name": "Triangle", "symbols": [(lexer.has("triosc") ? {type: "triosc"} : triosc)], "postprocess": id},
    {"name": "Square", "symbols": [(lexer.has("squareosc") ? {type: "squareosc"} : squareosc)], "postprocess": id},
    {"name": "Pulse", "symbols": [(lexer.has("pulseosc") ? {type: "pulseosc"} : pulseosc)], "postprocess": id},
    {"name": "Noise", "symbols": [(lexer.has("wnoise") ? {type: "wnoise"} : wnoise)], "postprocess": d => [{ "@wnoise" : d[0] }]},
    {"name": "Noise", "symbols": [(lexer.has("pnoise") ? {type: "pnoise"} : pnoise)], "postprocess": d => [{ "@pnoise" : d[0] }]},
    {"name": "Noise", "symbols": [(lexer.has("bnoise") ? {type: "bnoise"} : bnoise)], "postprocess": d => [{ "@bnoise" : d[0] }]},
    {"name": "Params$ebnf$1", "symbols": [(lexer.has("number") ? {type: "number"} : number)]},
    {"name": "Params$ebnf$1", "symbols": ["Params$ebnf$1", (lexer.has("number") ? {type: "number"} : number)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Params", "symbols": [(lexer.has("lbrack") ? {type: "lbrack"} : lbrack), "_", "Params$ebnf$1", "_", (lexer.has("rbrack") ? {type: "rbrack"} : rbrack)], "postprocess": d => console.log(d[2])},
    {"name": "Params", "symbols": [(lexer.has("number") ? {type: "number"} : number)], "postprocess": d => parseInt(d[0])},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", "wschar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": function(d) {return null;}},
    {"name": "__$ebnf$1", "symbols": ["wschar"]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", "wschar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "__", "symbols": ["__$ebnf$1"], "postprocess": function(d) {return null;}},
    {"name": "wschar", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id}
]
  , ParserStart: "main"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
