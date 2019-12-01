@{%
const moo = require("moo"); // this 'require' creates a node dependency


const lexer = moo.compile({
  separator:    /,/,
   paramEnd:     /\]/,
   paramBegin:   /\[/,
   binRangeBegin:   /{/,
   binRangeEnd:   /}/,
  operator:     /\\|\*|\+|\-|>>|<<|<|>|~|\^|&|\|/,
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
    case '+':
     res = { '@sigp':{ '@params': [d[0], d[4]],
           '@func': {value: 'bitAdd'}}};
     break;
    case '-':
     res = { '@sigp':{ '@params': [d[0], d[4]],
           '@func': {value: 'bitSub'}}};
     break;
    case '*':
     res = { '@sigp':{ '@params': [d[0], d[4]],
           '@func': {value: 'bitMul'}}};
     break;
    case '\\':
     res = { '@sigp':{ '@params': [d[0], d[4]],
           '@func': {value: 'bitDiv'}}};
     break;
    case '^':
     res = { '@sigp':{ '@params': [d[0], d[4]],
           '@func': {value: 'bitXor'}}};
     break;

    case '&':
     res = { '@sigp':{ '@params': [d[0], d[4]],
           '@func': {value: 'bitAnd'}}};
     break;
    case '|':
     res = { '@sigp':
         { '@params': [
           d[0], d[4]
         ],
           '@func': {
             value: 'bitOr'
           }
         }
       };
     break;
    case '<<':
     res = { '@sigp':
         { '@params': [
           d[0], d[4]
         ],
           '@func': {
             value: 'bitShl'
           }
         }
       };
     break;
    case '>>':
     res = { '@sigp':
         { '@params': [
           d[0], d[4]
         ],
           '@func': {
             value: 'bitShl'
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



%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
      Expression _ %semicolon _ Statement            {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      |
      Expression                                      {% d => [{"@sigOut": { "@spawn": bitToSig(d[0]) }}] %}

Expression ->  Term _ %operator _ Term
{%
d => binop(d)
%}

Term -> %paramBegin Expression %paramEnd {%id%}
| Expression {%id%}
| Number {%id%}
| %time {% d => timeOp() %}

Number -> %integer  {% (d) => ({"@num":d[0]}) %}
| BinaryNumber {% id %}

BinaryNumber -> %binarynumber {% id %}
| %binarynumber _ %binRangeBegin _ %integer _ %binRangeEnd

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
