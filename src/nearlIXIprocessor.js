// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }


const moo = require("moo"); // this 'require' creates a node dependency

const lexer = moo.compile({
  functionkeyword: ['doze', 'perk', 'nap', 'shake', 'swap', '>shift', 'shift<', 'inverse', 'expand', 'reverse'],
  functionname: /[a-zA-Z][a-zA-Z0-9]*/,
  number: /[-+]?[0-9]*\.?[0-9]+/,
  ws: {match: /\s+/, lineBreaks: true},
  lparen: /\(/,
  rparen: /\)/,
  lbrack: /\[/,
  rbrack: /\]/,
  lbrace: /\{/,
  rbrace: /\}/,
  pipe: /\|/,
  mult: /\*/,
  div: /\\/,
  add: /\+/,
  dot: /\./,
  assign: /->/,
  effectin: />>/,
  effectout: /<</,
  ampmore: /\(\(/,
  ampless: /\)\)/,
  silence: /!/,
  transpmore: /\+/,
  transpless: /\-/
});
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "Statement", "_"]},
    {"name": "Statement", "symbols": ["Agent", "_", "Operator", "_", "Mode"], "postprocess": 
        function(d) {
          return {
            agentName: d[0],
            operator: d[2],
            mode: d[4]
          };
        }
        },
    {"name": "Statement", "symbols": ["Agent", "_", "Operator", "_", "Name"], "postprocess": 
        function(d) {
          return {
            agentName: d[0],
            operator: d[2],
            effect: d[4]
          };
        }
        },
    {"name": "Agent", "symbols": ["Name"], "postprocess": id},
    {"name": "Mode", "symbols": ["Melodic"], "postprocess": id},
    {"name": "Mode", "symbols": ["Percussive"], "postprocess": id},
    {"name": "Mode", "symbols": ["Concrete"], "postprocess": id},
    {"name": "Melodic$ebnf$1", "symbols": [/[0-9 ]/]},
    {"name": "Melodic$ebnf$1", "symbols": ["Melodic$ebnf$1", /[0-9 ]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Melodic", "symbols": ["Name", (lexer.has("lbrack") ? {type: "lbrack"} : lbrack), "Melodic$ebnf$1", (lexer.has("rbrack") ? {type: "rbrack"} : rbrack), "PostScoreOperator"], "postprocess": 
        function(d) {
          return{
            scoreType: "Melodic",
            instrument: d[0],
            score: d[2].join(),
            postScoreOperator: d[4] //
          };
        }
        },
    {"name": "Percussive$ebnf$1", "symbols": [/[a-zA-Z0-9 ]/]},
    {"name": "Percussive$ebnf$1", "symbols": ["Percussive$ebnf$1", /[a-zA-Z0-9 ]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Percussive", "symbols": [(lexer.has("pipe") ? {type: "pipe"} : pipe), "Percussive$ebnf$1", (lexer.has("pipe") ? {type: "pipe"} : pipe), "PostScoreOperator"], "postprocess": 
        function(d) {
          return{
            scoreType: "Percussive",
            score: d[1].join(),
            postScoreOperator: d[3] //
          };
        }
        },
    {"name": "Concrete$ebnf$1", "symbols": [/[0-9 ]/]},
    {"name": "Concrete$ebnf$1", "symbols": ["Concrete$ebnf$1", /[0-9 ]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Concrete", "symbols": ["Name", (lexer.has("lbrace") ? {type: "lbrace"} : lbrace), "Concrete$ebnf$1", (lexer.has("rbrace") ? {type: "rbrace"} : rbrace), "PostScoreOperator"], "postprocess": 
        function(d) {
          return{
            scoreType: "Concrete",
            instrument: d[0],
            score: d[2].join(),
            postScoreOperator: d[4] //
          };
        }
        },
    {"name": "Name", "symbols": [(lexer.has("functionname") ? {type: "functionname"} : functionname)], "postprocess": id},
    {"name": "Name", "symbols": [(lexer.has("functionkeyword") ? {type: "functionkeyword"} : functionkeyword)], "postprocess": id},
    {"name": "Operator", "symbols": [(lexer.has("assign") ? {type: "assign"} : assign)], "postprocess": id},
    {"name": "Operator", "symbols": [(lexer.has("effectin") ? {type: "effectin"} : effectin)], "postprocess": id},
    {"name": "Operator", "symbols": [(lexer.has("effectout") ? {type: "effectout"} : effectout)], "postprocess": id},
    {"name": "Operator", "symbols": [(lexer.has("ampmore") ? {type: "ampmore"} : ampmore)], "postprocess": id},
    {"name": "Operator", "symbols": [(lexer.has("ampless") ? {type: "ampless"} : ampless)], "postprocess": id},
    {"name": "PostScoreOperator", "symbols": [(lexer.has("silence") ? {type: "silence"} : silence)], "postprocess": id},
    {"name": "PostScoreOperator", "symbols": [(lexer.has("transpmore") ? {type: "transpmore"} : transpmore)], "postprocess": id},
    {"name": "PostScoreOperator", "symbols": [(lexer.has("transpless") ? {type: "transpless"} : transpless)], "postprocess": id},
    {"name": "PostScoreOperator", "symbols": [(lexer.has("mult") ? {type: "mult"} : mult)], "postprocess": id},
    {"name": "PostScoreOperator", "symbols": []},
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
