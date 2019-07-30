// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

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
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "Metastatement", "_"], "postprocess": d => ({ "@lang" : d[1] })},
    {"name": "Metastatement", "symbols": ["Statement"], "postprocess": id},
    {"name": "Metastatement", "symbols": ["Loop"], "postprocess": id},
    {"name": "Statement", "symbols": ["Expression", "_", (lexer.has("semicolon") ? {type: "semicolon"} : semicolon), "_", "Statement"], "postprocess": d => [{ "@spawn": d[0] }].concat(d[4])},
    {"name": "Statement", "symbols": ["Expression"], "postprocess": d => [{"@sigOut": { "@spawn": d[0] }}]},
    {"name": "Parens", "symbols": [(lexer.has("lparens") ? {type: "lparens"} : lparens), "_", "Metastatement", "_", (lexer.has("rparens") ? {type: "rparens"} : rparens)], "postprocess": d => d[2]},
    {"name": "Loop", "symbols": [{"literal":"do"}, "_", "Int", "_", "Parens", "_"], "postprocess": 
        d => {
          let looped = [];
          const loopCount = parseInt(d[2]);
          for (let i=0; i<loopCount; i++)
          {
            looped = looped.concat(d[4]);
          }
          return looped;
        }
        },
    {"name": "Expression", "symbols": ["ParameterList", "_", (lexer.has("funcName") ? {type: "funcName"} : funcName)], "postprocess": d => ({ "@synth": Object.assign(d[0],{"@jsfunc":d[2]})})},
    {"name": "Expression", "symbols": ["ParameterList", "_", (lexer.has("sample") ? {type: "sample"} : sample)], "postprocess":  d => {d[0]["@params"] = d[0]["@params"].concat([{"@string":d[2].value}]);
        return { "@synth": Object.assign(d[0],{"@jsfunc":{value:"sampler"}})}} },
    {"name": "Expression", "symbols": [(lexer.has("oscAddress") ? {type: "oscAddress"} : oscAddress)], "postprocess": d => ({ "@synth": {"@params":[{"@string":d[0].value},{"@num":{value:-1}}], "@jsfunc":{value:"oscin"}}} )},
    {"name": "Expression", "symbols": ["ParameterList", "_", (lexer.has("oscAddress") ? {type: "oscAddress"} : oscAddress)], "postprocess": d => ({ "@synth": {"@params":[{"@string":d[2].value},d[0]["@params"][0]], "@jsfunc":{value:"oscin"}}} )},
    {"name": "Expression", "symbols": [(lexer.has("variable") ? {type: "variable"} : variable), "_", "Expression"], "postprocess": d => ({"@setvar": {"@varname":d[0],"@varvalue":d[2]}} )},
    {"name": "ParameterList", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd)], "postprocess": d => ({"paramBegin":d[0], "@params":d[1], "paramEnd":d[2]} )},
    {"name": "Params", "symbols": ["ParamElement"], "postprocess": (d) => ([d[0]])},
    {"name": "Params", "symbols": ["ParamElement", "_", (lexer.has("separator") ? {type: "separator"} : separator), "_", "Params"], "postprocess": d => [d[0]].concat(d[4])},
    {"name": "ParamElement", "symbols": [(lexer.has("number") ? {type: "number"} : number)], "postprocess": (d) => ({"@num":d[0]})},
    {"name": "ParamElement", "symbols": ["Expression"], "postprocess": id},
    {"name": "ParamElement", "symbols": [(lexer.has("variable") ? {type: "variable"} : variable)], "postprocess": (d) => ({"@getvar":d[0]})},
    {"name": "ParamElement", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Params", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd)], "postprocess": (d) => ({"@list":d[1]})},
    {"name": "Int$ebnf$1", "symbols": [/[1-9]/]},
    {"name": "Int$ebnf$1", "symbols": ["Int$ebnf$1", /[1-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Int", "symbols": ["Int$ebnf$1"]},
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
