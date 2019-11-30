# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
const lexer = moo.compile({
  saw:       /serra/,
  click:     /click/, // match the string 'click'
  ws:        {match: /\s+/, lineBreaks: true}, // match whitespace
	number:    /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/
});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _ Statement _ 
{% d => ( { "@lang" : d[1] }) %}

Statement -> %click 
{% d => [{
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
  }]
%}

Statement -> %saw
  {% d =>  [{
  "@lang": [{
    "@sigOut": {
      "@spawn": {
        "@sigp": {
          "@params": [{
            "@num": {
              "value": "440"
            }
          }],
          "@func": {
            "value": "saw"
          }
        }
      }
    }
  }]
}]
  %}


_  -> wschar:*    {% function(d) {return null;} %} # 0 or more whitespace characters
__ -> wschar:+    {% function(d) {return null;} %} # 1 or more whitespace characters

wschar -> %ws     {% id %}
