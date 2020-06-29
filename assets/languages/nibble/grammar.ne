# GRAMMAR EDITOR

@{%
/*
Documentation:

works with unsigned 32 bit values

Named variables:

t = time
c = clock
n = noise

Operators:

Precedence: left to right, expect when using square brackets []

Output: is converted from uint32 to double between -1 and 1: output = ((binary value / 2^32) - 0.5) * 2

Examples:

t * [c*1>>4] & 1023 * [c>>4&1] ^ [t>>1] << 22;


t * 1 &  1023 << [30 - [c>>3]] * [t & 18 <<1] * [t >>20] * [c >> 4 ^ 1];

n * [[c>>5 & 1] & [c>>4 & 1]];


t  * [t|[t<<1^908&4|[t<<929]] >> b1] << [c>>3] * [[c*1>> 3 & 11] & [c *4 >> 8 | 1]];

--evolving pattern
t  * [c|[c<<3^91&4|[t<<929]] >> b1010] << [c>>3] * [[c*1>> 3 & 11] & [c *7 >> 19  | 1 ]]

t & [c*4] << 22 ^ [[n ^ [c&4]]>>2];

-- sequencing
t & 255 << 22 * b1101_0111{[c>>4]}

-- variables

t  * [c|[c<<3^91&4|[t<<929]] >> b1010] << [c>>3] * [[c*4>> 5 & 13] ^ [c *7 >> 19  | 1 ]] -> seq1;

t  * [c|[c<<4^191&4|[t<<92]] ->seq3 >> b1010] << [c>>5] * [[c*3>> 3 & 11] & [c *7 >> 19  | 1 ]] -> seq2;

seq1|seq2 & 1023 << 24 | [seq1 * seq3] * [t&seq3]

--- simple sequencing using and

[c & b1010000 > 0] -> \909b

---

sequencing with modulus counter

t * [t>>12%9] << 23 * b10100010{t>>12%8} * [t>>12|[t&12336]]

--- mixing up samples, gabba

[c & b1000010100101 >0] -> \909b ->a1;
[c * 2 & b1000100101>0] -> \kernel ->a2;
[c>>4 & b1000101>0] -> \heart ->a3;
a1^a2 ^ [a3 * t{17}]

*/

const lexer = moo.compile({
  separator:    /,/,
  paramEnd:     /\]/,
  paramBegin:   /\[/,
  binRangeBegin:   /{/,
  binRangeEnd:   /}/,
  binarynumber:       /b[0-1\_]+/,
    assignOperator: /->/,
  integer:       /[0-9]+/,
  semicolon:    /;/,
  variable:     /[a-zA-Z][a-zA-Z0-9]+/,
    time: /[t]/,
    clock: /[c]/,
    noise: /[n]/,
  sampleName:     /\\[a-zA-Z0-9]*/,
  operator: /\/|\||\*|\+|\-|>>|<<|<|>|~|\^|&|%|=|>=|<=/,
  comment:      /\#[^\n]:*/,
  ws:           {match: /\s+/, lineBreaks: true},
});

function binop(operation, op1,op2) {
  var res;
  switch(operation.value) {
    case '=':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitEq'}}};
     break;
    case '>':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitGt'}}};
     break;
    case '>=':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitGte'}}};
     break;
    case '<':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitLt'}}};
     break;
    case '<=':
     res = { '@sigp':{ '@params': [op1,op2],
           '@func': {value: 'bitLte'}}};
     break;
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
    case "%":
     res = { '@sigp':
         { '@params': [
           op1,op2
         ],
           '@func': {
             value: 'mod'
           }
         }
       };
     break;
  };
  return res;
}

function setvar(name, branch) {
    return { "@setvar": { "@varname": name, "@varvalue": branch } };
}

function getvar(name) {
    return { "@getvar": name };
}

function assignvar(op1,op2) {
  var res;
    res = setvar(op2, op1)
  return res;
}

function str(val) {
    return { "@string": val };
}


function sampler(trig,sampleName) {
  var samplerTree = {'@sigp': { "@params": [bitToTrigSig(trig), str(sampleName)], "@func": { value: 'sampler' } } };
  return bitFromSig(samplerTree);
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
function noiseOp() {
    return  { '@sigp':
  {'@params': [],
    '@func': {
      value: 'bitnoise'
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
function bitToTrigSig(d) {
  return  { '@sigp':
  {'@params': [d],
    '@func': {
      value: 'bitToTrigSig'
    }
  }
  };
}
function bitFromSig(d) {
  return  { '@sigp':
  {'@params': [d],
    '@func': {
      value: 'bitFromSig'
    }
  }
  };
}

function binStrToNum(d) {
    return {"@num":{'value':parseInt(d.value.replace('_','').substr(1),2)}}
}

function binElement(d, idx) {
  return  { '@sigp':
  {'@params': [d,idx],
    '@func': {
      value: 'bitAt'
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
      Expression
		{% d => [{ "@spawn": sema.synth('dac',[ bitToSig(d[0]) ]) }] %}

Expression ->

Expression _ %operator _ Term
{%d => binop(d[2],d[0],d[4])%}
|
Expression _ %assignOperator _ %variable
{%d => assignvar(d[0],d[4])%}
|
Expression _ %assignOperator _ %sampleName
{%d => sampler(d[0],d[4].value)%}
#| Term _ %operator _ Term
#{%d => binop(d[2],d[0],d[4])%}
| Term {%id%}

Term ->
NumericElement {%id%}
|
NumericElement _ %binRangeBegin _ Expression _ %binRangeEnd
{% (d) => binElement(d[0],d[4])%}



NumericElement -> %paramBegin _ Expression _ %paramEnd {%d=>d[2]%}
| Number {%id%}
| %time {% d => timeOp() %}
| %clock {% d=> clockOp() %}
| %noise {% d=> noiseOp() %}
| %variable {% d => getvar(d[0])%}



Number ->
IntOrBin {%id%}

IntOrBin ->
%integer  {% (d) => ({"@num":d[0]}) %}
| BinaryNumber {% id %}

BinaryNumber -> %binarynumber
{% (d) => binStrToNum(d[0])%}

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
