// Generated automatically by nearley, version 2.19.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  separator:    /,/,
   paramEnd:     /\]/,
   paramBegin:   /\[/,
   binRangeBegin:   /{/,
   binRangeEnd:   /}/,
  operator:     /\+|\-|>>|<<|<|>|~|&|\|/,
  binarynumber:       /b[0-1]+/,
  integer:       /[0-9]+/,
  semicolon:    /;/,
	time: /[t]/,
  comment:      /\#[^\n]:*/,
  ws:           {match: /\s+/, lineBreaks: true},
});

function binop(d) {
  var res;
  switch(d[2].value) {
    case '&':
     res = { '@sigp':
         { '@params': [
           d[0], d[4]
         ],
           '@func': {
             value: 'bitAnd'
           }
         }
       };
     break;
  };
  return res;
}

function timeOp() {
	return  { '@sigp':
  {'@params': [],
    '@func': {
      value: 'btime'
    }
  }
  };
}


function bitToSig(d) {
  return  { '@sigp':
  {'@params': [d],
    '@func': {
      value: 'bitToSig'
    }
  }
  };
}



var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "Statement", "_"], "postprocess": d => ({ "@lang" : d[1] })},
    {"name": "Statement", "symbols": ["Expression", "_", (lexer.has("semicolon") ? {type: "semicolon"} : semicolon), "_", "Statement"], "postprocess": d => [{ "@spawn": d[0] }].concat(d[4])},
    {"name": "Statement", "symbols": ["Expression"], "postprocess": d => [{"@sigOut": { "@spawn": bitToSig(d[0]) }}]},
    {"name": "Expression", "symbols": ["Term", "_", (lexer.has("operator") ? {type: "operator"} : operator), "_", "Term"], "postprocess": 
        d => binop(d)
        },
    {"name": "Term", "symbols": [(lexer.has("paramBegin") ? {type: "paramBegin"} : paramBegin), "Expression", (lexer.has("paramEnd") ? {type: "paramEnd"} : paramEnd)], "postprocess": id},
    {"name": "Term", "symbols": ["Expression"], "postprocess": id},
    {"name": "Term", "symbols": ["Number"], "postprocess": id},
    {"name": "Term", "symbols": [(lexer.has("time") ? {type: "time"} : time)], "postprocess": d => timeOp()},
    {"name": "Number", "symbols": [(lexer.has("integer") ? {type: "integer"} : integer)], "postprocess": (d) => ({"@num":d[0]})},
    {"name": "Number", "symbols": ["BinaryNumber"], "postprocess": id},
    {"name": "BinaryNumber", "symbols": [(lexer.has("binarynumber") ? {type: "binarynumber"} : binarynumber)], "postprocess": id},
    {"name": "BinaryNumber", "symbols": [(lexer.has("binarynumber") ? {type: "binarynumber"} : binarynumber), "_", (lexer.has("binRangeBegin") ? {type: "binRangeBegin"} : binRangeBegin), "_", (lexer.has("integer") ? {type: "integer"} : integer), "_", (lexer.has("binRangeEnd") ? {type: "binRangeEnd"} : binRangeEnd)]},
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
