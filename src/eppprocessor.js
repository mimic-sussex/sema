// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  functionkeyword: ['sinosc', 'phasor', 'adsr', 'filter', 'samp'],
  o: /o/,
  x: /x/,
  functionname: /[a-zA-Z][a-zA-Z0-9]*/,
  number: /[-+]?[0-9]*\.?[0-9]+/,
  ws: {match: /\s+/, lineBreaks: true},
  lparen: /\(/,
  rparen: /\)/,
  lbrack: /\[/,
  rbrack: /\]/,
  pipe: /\|/,
  mult: /\*/,
  add: /\+/,
  dot: /\./,
  assign: /->/,
  bindr: />>/,
  bindl: /<</,
  ampmore: /\(\(/,
  ampless: /\)\)/,
  silence: /!/,
  transpmore: /\+/,
  underscore: /\_/,
  hyphen: /\-/,
  ndash: /\–/,
  mdash: /\—/,
  colon: /\:/,
  semicolon: /\;/
});
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["Lines"], "postprocess": d =>  ({ "@lang" : d[0] })},
    {"name": "Lines", "symbols": ["Line", "_", (lexer.has("semicolon") ? {type: "semicolon"} : semicolon), "_", "Lines"], "postprocess": d => [{ "@spawn" : d[0] }].concat(d[4])},
    {"name": "Lines", "symbols": ["Line"], "postprocess": d => [{ "@spawn" : d[0] }]},
    {"name": "Line", "symbols": ["Synth"], "postprocess": id},
    {"name": "Line", "symbols": ["Loop"], "postprocess": id},
    {"name": "Line", "symbols": ["Beats"], "postprocess": id},
    {"name": "Synth", "symbols": ["Params", "_", (lexer.has("bindr") ? {type: "bindr"} : bindr), "_", "Functions"], "postprocess":  d => ({
          "@synth": {
            "@params": d[0],
            "@functions": d[4]
          }
        }) },
    {"name": "Params", "symbols": [(lexer.has("number") ? {type: "number"} : number), "_", (lexer.has("pipe") ? {type: "pipe"} : pipe), "_", "Params"], "postprocess": d =>  [ parseFloat(d[0]), d[4] ]},
    {"name": "Params", "symbols": [(lexer.has("number") ? {type: "number"} : number)], "postprocess": d => parseFloat(d[0])},
    {"name": "Functions", "symbols": [(lexer.has("functionkeyword") ? {type: "functionkeyword"} : functionkeyword), "_", (lexer.has("bindr") ? {type: "bindr"} : bindr), "_", "Functions"], "postprocess": d => [ d[0] ].concat(d[4])},
    {"name": "Functions", "symbols": [(lexer.has("functionkeyword") ? {type: "functionkeyword"} : functionkeyword)], "postprocess": d => d[0]},
    {"name": "Loop", "symbols": [{"literal":"["}, "Beats", {"literal":"]"}], "postprocess": d => ({ "@loop": d[1] })},
    {"name": "Beats$ebnf$1", "symbols": ["Beat"]},
    {"name": "Beats$ebnf$1", "symbols": ["Beats$ebnf$1", "Beat"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Beats", "symbols": ["Beats$ebnf$1"], "postprocess": d => ({ "@beats": d[0].join() })},
    {"name": "Beat", "symbols": ["Rest"], "postprocess": id},
    {"name": "Beat", "symbols": ["Hat"], "postprocess": id},
    {"name": "Beat", "symbols": ["Snare"], "postprocess": id},
    {"name": "Beat", "symbols": ["Kick"], "postprocess": id},
    {"name": "Rest", "symbols": [(lexer.has("dot") ? {type: "dot"} : dot)], "postprocess": id},
    {"name": "Hat", "symbols": [(lexer.has("hyphen") ? {type: "hyphen"} : hyphen)], "postprocess": id},
    {"name": "Snare", "symbols": [(lexer.has("o") ? {type: "o"} : o)], "postprocess": id},
    {"name": "Kick", "symbols": [(lexer.has("x") ? {type: "x"} : x)], "postprocess": id},
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
