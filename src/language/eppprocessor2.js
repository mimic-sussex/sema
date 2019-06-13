// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
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
    {"name": "Expression", "symbols": ["Synth"], "postprocess": d => ({ "@synth": d[0] })},
    {"name": "Synth", "symbols": ["Function"], "postprocess": d => ({ "@func": d[0] })},
    {"name": "Function", "symbols": ["OscFunc", "_", (lexer.has("add") ? {type: "add"} : add), "_", "Function"], "postprocess": d => [{ "@add": [ Object.assign({}, d[0]) ].concat(d[4])}]},
    {"name": "Function", "symbols": ["OscFunc"]},
    {"name": "OscFunc", "symbols": ["Oscillator", "_", (lexer.has("lparen") ? {type: "lparen"} : lparen), "_", "Function", "_", (lexer.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": d => ({ "@comp": [d[0]].concat(d[4])})},
    {"name": "OscFunc", "symbols": ["Oscillator", "_", "Params"], "postprocess": d => Object.assign({}, d[0], { param: d[2]})},
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
