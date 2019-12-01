@{%

const lexer = moo.compile({
  separator:    /,/,
   paramEnd:     /\]/,
   paramBegin:   /\[/,
   binRangeBegin:   /{/,
   binRangeEnd:   /}/,
  variable:     /:[a-zA-Z0-9]+:/,
  operator:     /\/|\*|\+|\-|>>|<<|<|>|~|\^|&|\|/,
  binarynumber:       /b[0-1]+/,
  integer:       /[0-9]+/,
  semicolon:    /;/,
	time: /[t]/,
  comment:      /\#[^\n]:*/,
  ws:           {match: /\s+/, lineBreaks: true},
});

function binop(operation, op1,op2) {
  var res;
  switch(operation.value) {
    case '+':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitAdd'}}};
     break;
    case '-':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitSub'}}};
     break;
    case '*':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitMul'}}};
     break;
    case '\\':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitDiv'}}};
     break;
    case '^':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitXor'}}};
     break;

    case '&':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitAnd'}}};
     break;
    case '|':
     res = { '@sigp':
         { '@params': [
           op1,op2
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
           op1,op2
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
           op1,op2
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

Expression ->
#|
Expression _ %operator _ Term
{%d => binop(d[2],d[0],d[4])%}
| Term _ %operator _ Term
{%d => binop(d[2],d[0],d[4])%}

Term ->
 Number {%id%}
| %time {% d => timeOp() %}
|%paramBegin _ Expression _ %paramEnd
{%d=>d[2]%}


Number -> %integer  {% (d) => ({"@num":d[0]}) %}
| BinaryNumber {% id %}

BinaryNumber -> %binarynumber {% id %}
| %binarynumber _ %binRangeBegin _ %integer _ %binRangeEnd

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
