# GRAMMAR EDITOR

# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
	
	// write the Regular Expressions for your tokens here 
	const lexer = moo.compile({ 
		
	});

%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
# main -> _ Statement _

# Whitespace

_  -> wschar:*
{% function(d) {return null;} %}

__ -> wschar:+
{% function(d) {return null;} %}

wschar -> %ws
{% id %}
