@{%

/*
some nibble examples

//this evolves continually
t  * [t|[t<<1^98&4|[t<<29]] >> b1] << [c>>8] * [[c *1>> 4 & 11] & [c *1 >> 4 | 1]]

*/

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
	clock: /[c]/,
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
             value: 'bitShr'
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

function clockOp() {
	return  { '@sigp':
  {'@params': [],
    '@func': {
      value: 'bitclock'
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

function binStrToNum(d) {
	return {"@num":{'value':parseInt(d.value.substr(1),2)}}
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

Expression _ %operator _ Term
{%d => binop(d[2],d[0],d[4])%}
| Term _ %operator _ Term
{%d => binop(d[2],d[0],d[4])%}

Term ->
%paramBegin _ Expression _ %paramEnd {%d=>d[2]%}
| Number {%id%}
| %time {% d => timeOp() %}
| %clock {% d=> clockOp() %}



Number -> %integer  {% (d) => ({"@num":d[0]}) %}
| BinaryNumber {% id %}

BinaryNumber -> %binarynumber
{% (d) => binStrToNum(d[0])%}

| %binarynumber _ %binRangeBegin _ %integer _ %binRangeEnd

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
