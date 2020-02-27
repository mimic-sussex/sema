# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
const lexer = moo.compile({
  click:    /click/,                            // match the string 'click'
  convol1:  /convol1/,                            // match the string 'click'
  heart:    /heart/,                            // match the string 'click'
  ws:     { match: /\s+/, lineBreaks: true } // match whitespace
});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar rules specified in the Extended Backus Naur Form (EBNF)
main -> _ Statement _ # 
{% d => ( { "@lang" : d[1] })  %}

Statement -> %click
{% d =>  [{
  "@sigOut": {
    '@spawn': {
      '@sigp': {
        '@params': [{
            '@num': {
              value: 1
            }
          },
          {
            '@string': 'click'
          }
        ],
        '@func': {
          value: 'loop'
        }
      }
    }
  }
}]
%}
| %convol1
{% d =>  [{
  "@sigOut": {
    '@spawn': {
      '@sigp': {
        '@params': [{
            '@num': {
              value: 1
            }
          },
          {
            '@string': 'convol1'
          }
        ],
        '@func': {
          value: 'loop'
        }
      }
    }
  }
}]
%}
|
%heart
{% d =>  [{
  "@sigOut": {
    '@spawn': {
      '@sigp': {
        '@params': [{
            '@num': {
              value: 1
            }
          },
          {
            '@string': 'heart'
          }
        ],
        '@func': {
          value: 'loop'
        }
      }
    }
  }
}]
%}

_  -> wschar:*    {% function(d) {return null;} %} # 0 or more whitespace characters
__ -> wschar:+    {% function(d) {return null;} %} # 1 or more whitespace characters

wschar -> %ws     {% id %}