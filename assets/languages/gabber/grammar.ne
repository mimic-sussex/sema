@{%
  /*
  Documentation:


  */

const lexer = moo.compile({
  separator:        /,/,
  paramEnd:         /\]/,
  paramBegin:       /\[/,
  binRangeBegin:    /{/,
  binRangeEnd:      /}/,
  binarynumber:     /b[0-1\_]+/,
  assignOperator:   /->/,
  integer:          /[0-9]+/,
  semicolon:        /;/,
  variable:         /[a-zA-Z][a-zA-Z0-9]+/,
  time:             /[t]/,
  clock:            /[c]/,
  noise:            /[n]/,
  sampleName:       /\\[a-zA-Z0-9]*/,
  operator:         /\/|\||\*|\+|\-|>>|<<|<|>|~|\^|&|=|>=|<=/,
  comment:          /\#[^\n]:*/,
  ws:               { match: /\s+/, lineBreaks: true },
});

function binop(operation, op1, op2) {
  let res;
  switch (operation.value) {
    case '=':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitEq'
          }
        }
      };
      break;
    case '>':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitGt'
          }
        }
      };
      break;
    case '>=':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitGte'
          }
        }
      };
      break;
    case '<':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitLt'
          }
        }
      };
      break;
    case '<=':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitLte'
          }
        }
      };
      break;
    case '+':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitAdd'
          }
        }
      };
      break;
    case '-':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitSub'
          }
        }
      };
      break;
    case '*':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitMul'
          }
        }
      };
      break;
    case '\\':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitDiv'
          }
        }
      };
      break;
    case '^':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitXor'
          }
        }
      };
      break;    
    case '&':
      res = {
        '@sigp': {
          '@params': [op1, op2],
          '@func': {
            value: 'bitAnd'
          }
        }
      };
      break;
    case '|':
      res = {
        '@sigp': {
          '@params': [
            op1, op2
          ],
          '@func': {
            value: 'bitOr'
          }
        }
      };
      break;
    case '<<':
      res = {
        '@sigp': {
          '@params': [
            op1, op2
          ],
          '@func': {
            value: 'bitShl'
          }
        }
      };
      break;
    case '>>':
      res = {
        '@sigp': {
          '@params': [
            op1, op2
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

function setvar(name, branch) {
  return {
    "@setvar": {
      "@varname": name,
      "@varvalue": branch
    }
  };
}

function getvar(name) {
  return {
    "@getvar": name
  };
}

function assignvar(op1, op2) {
  var res;
  res = setvar(op2, op1)
  return res;
}

function str(val) {
  return {
    "@string": val
  };
}

function sampler(trig, sampleName) {
  var samplerTree = {
    '@sigp': {
      "@params": [bitToTrigSig(trig), str(sampleName)],
      "@func": {
        value: 'sampler'
      }
    }
  };
  return bitFromSig(samplerTree);
}

function timeOp() {
  return {
    '@sigp': {
      '@params': [],
      '@func': {
        value: 'btime'
      }
    }
  };
}

function clockOp() {
  return {
    '@sigp': {
      '@params': [],
      '@func': {
        value: 'bitclock'
      }
    }
  };
}

function noiseOp() {
  return {
    '@sigp': {
      '@params': [],
      '@func': {
        value: 'bitnoise'
      }
    }
  };
}

function bitToSig(d) {
  return {
    '@sigp': {
      '@params': [d],
      '@func': {
        value: 'bitToSig'
      }
    }
  };
}

function bitToTrigSig(d) {
  return {
    '@sigp': {
      '@params': [d],
      '@func': {
        value: 'bitToTrigSig'
      }
    }
  };
}

function bitFromSig(d) {
  return {
    '@sigp': {
      '@params': [d],
      '@func': {
        value: 'bitFromSig'
      }
    }
  };
}

function binStrToNum(d) {
  return {
    "@num": {
      'value': parseInt(d.value.replace('_', '').substr(1), 2)
    }
  }
}

function binElement(d, idx) {
  return {
    '@sigp': {
      '@params': [d, idx],
      '@func': {
        value: 'bitAt'
      }
    }
  };

}


%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _
{% d => ({ "@lang": d[1] }) %}

Statement ->
  %comment _ Statement
  {% d => d[2] %}
	|
  Expression _ %semicolon _ Statement
  {% d => [ { '@spawn': d[0] } ].concat(d[4]) %}
  |
  Expression _ %semicolon (_ %comment):*
  {% d => [ { '@spawn': d[0] } ] %}


Expression ->
  Expression _ %operator _ Term
  {% d => binop(d[2], d[0], d[4]) %}
  |
  Expression _ %assignOperator _ %variable 
  {% d => assignvar(d[0], d[4]) %} 
  |
  Expression _ %assignOperator _ %sampleName 
  {% d => sampler(d[0], d[4].value) %}
  | 
  Term _ %operator _ Term
  {% d => binop(d[2], d[0], d[4]) %}
  |
  Term {% id %}

Term ->
  NumericElement {% id %}
  |
  NumericElement _ %binRangeBegin _ Expression _ %binRangeEnd 
  {% (d) => binElement(d[0], d[4]) %}

NumericElement -> 
  %paramBegin _ Expression _ %paramEnd 
  {% d => d[2] %}
  |
  Number {% id %}
  |
  %time 
  {% d => timeOp() %} 
  |
  %clock 
  {% d => clockOp() %}
  |
  %noise
  {% d => noiseOp() %}
  |
  %variable 
  {% d => getvar(d[0]) %}

NumericElement -> %paramBegin _ Expression _ %paramEnd 
  {% d => d[2] %} 
  |
  Number {% id %}
  |
  %time {% d => timeOp() %}
  |
  %clock
  {% d => clockOp() %}
  |
  %noise {% d => noiseOp() %} 
  |
  %variable 
  {% d => getvar(d[0]) %}

Number ->
  IntOrBin
  {% id %}

IntOrBin ->
  %integer 
  {% (d) => ({ "@num": d[0] }) %} 
  |
  BinaryNumber {% id %}

BinaryNumber -> 
  %binarynumber
  {% (d) => binStrToNum(d[0]) %}

# Whitespace

_ -> 
  wschar:*
  {% function (d) {  return null; } %}

__ -> 
  wschar:+
  {% function (d) { return null; } %}

wschar -> 
  %ws
  {% id %}