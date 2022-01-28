# GRAMMAR EDITOR
# GRAMMAR TEMPLATE

# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
	const lexer = moo.compile({ 
    	// write the Regular Expressions for your tokens here 

	});

%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main -> _

# Whitespace

_  -> wschar:*
{% function(d) { return null; } %}

__ -> wschar:+
{% function(d) { return null; } %}

wschar -> %ws
{% id %}
