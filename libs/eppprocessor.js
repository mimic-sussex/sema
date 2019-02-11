// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  functionkeyword: ['sinosc', 'phasor', 'adsr', 'filter', 'samp'],
  functionname: /[a-zA-Z][a-zA-Z0-9]*/,
  number: /[-+]?[0-9]*\.?[0-9]+/,
  ws: {match: /\s+/, lineBreaks: true},
  lparen: /\(/,
  rparen: /\)/,
  lbrack: /\[/,
  rbrack: /\]/,
  mult: /\*/,
  add: /\+/,
  dot: /\./
});
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "Statement", "_"]},
    {"name": "Statement", "symbols": ["Func", (lexer.has("lparen") ? {type: "lparen"} : lparen), "Statement", (lexer.has("rparen") ? {type: "rparen"} : rparen)]},
    {"name": "Statement", "symbols": ["Statement", (lexer.has("dot") ? {type: "dot"} : dot), "Statement"]},
    {"name": "Statement", "symbols": ["Statement", (lexer.has("add") ? {type: "add"} : add), "Statement"]},
    {"name": "Statement", "symbols": ["Statement", (lexer.has("mult") ? {type: "mult"} : mult), "Statement"]},
    {"name": "Statement", "symbols": [(lexer.has("number") ? {type: "number"} : number)]},
    {"name": "Func", "symbols": [(lexer.has("functionname") ? {type: "functionname"} : functionname)]},
    {"name": "Func", "symbols": [(lexer.has("functionkeyword") ? {type: "functionkeyword"} : functionkeyword)]},
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
