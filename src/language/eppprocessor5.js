// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  separator:    /,/,
  paramEnd:     /}/,
  paramBegin:   /{/,
  variable:     /:[a-zA-Z0-9]+:/,
  oscAddress:   /(?:\/[a-zA-Z0-9]+)+/,
  sample:       /\\[a-zA-Z0-9]+/,
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
  funcName: /[a-zA-Z][a-zA-Z0-9]*/,
  number:       /[-+]?[0-9]*\.?[0-9]+/,
  ws:   {match: /\s+/, lineBreaks: true},
});
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "Statement", "_"], "postprocess": d => ({ "@lang" : d[1] })},
    {"name": "Statement", "symbols": ["Expression"], "postprocess": d => [{ "@spawn": d[0] }]},
    {"name": "Expression", "symbols": [(lexer.has("variable") ? {type: "variable"} : variable), (lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd), (lexer.has("funcName") ? {type: "funcName"} : funcName)], "postprocess": d => ({"@setvar": {"@varname":d[0],"@varvalue":{ "@synth": {"@params":d[2], "@jsfunc":d[4], "paramBegin":d[1], "paramEnd":d[3]}}}} )},
    {"name": "Expression", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd), (lexer.has("funcName") ? {type: "funcName"} : funcName)], "postprocess": d => ({"@setvar": {"@varname":":default:","@varvalue":{ "@synth": {"@params":d[1], "@jsfunc":d[3], "paramBegin":d[0], "paramEnd":d[2]}}}} )},
    {"name": "Expression", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd), (lexer.has("sample") ? {type: "sample"} : sample)], "postprocess": d => ({ "@synth": {"@params":[{"@string":d[3].value}].concat(d[1]), "@jsfunc":{value:"sampler"}, "paramBegin":d[0], "paramEnd":d[2]}} )},
    {"name": "Expression", "symbols": [(lexer.has("oscAddress") ? {type: "oscAddress"} : oscAddress)], "postprocess": d => ({ "@synth": {"@params":[{"@string":d[0].value},{"@num":{value:-1}}], "@jsfunc":{value:"oscin"}}} )},
    {"name": "Params$subexpression$1", "symbols": [(lexer.has("number") ? {type: "number"} : number)]},
    {"name": "Params", "symbols": ["Params$subexpression$1"], "postprocess": (d) => ([{"@num":d[0][0]}])},
    {"name": "Params", "symbols": ["Expression"], "postprocess": (d) => ([{"@num":d[0]}])},
    {"name": "Params", "symbols": [(lexer.has("number") ? {type: "number"} : number), (lexer.has("separator") ? {type: "separator"} : separator), "Params"], "postprocess": d => [{ "@num": d[0]}].concat(d[2])},
    {"name": "Params", "symbols": ["Expression", (lexer.has("separator") ? {type: "separator"} : separator), "Params"], "postprocess": d => [{ "@num": d[0]}].concat(d[2])},
    {"name": "Params", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd)], "postprocess": (d) => ([{"@list":d[1]}])},
    {"name": "Params", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd), (lexer.has("separator") ? {type: "separator"} : separator), "Params"], "postprocess": d => [{ "@list": d[1]}].concat(d[4])},
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
