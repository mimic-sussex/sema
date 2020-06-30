# GRAMMAR EDITOR

# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
	// write the Regular Expressions for your tokens here 
	const lexer = moo.compile({ 
		click:  /click/,
		ws: 	  { match: /\s+/, lineBreaks: true }
	});
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)

main -> _ Statement _
{% 
	function(d){ return { "@lang": d[1] } } // JS function definition 
%}

Statement -> %click
{% 
	// JS 'arrow' function definition 
	d => [{
		'@spawn': {
			'@sigp': {
				'@params': [{        
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
				}],
				'@func' : {
					value: "dac"
				}
			}
		}
	}]
%}

# Whitespace

_  -> wschar:*
{% function(d) {return null;} %}

__ -> wschar:+
{% function(d) {return null;} %}

wschar -> %ws
{% id %}
