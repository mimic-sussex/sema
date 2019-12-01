@{%

const lexer = moo.compile({
  separator:    /,/,
   paramEnd:     /\]/,
   paramBegin:   /\[/,
   binRangeBegin:   /{/,
   binRangeEnd:   /}/,
	 opand: /&/,
  operator:     />>|<<|<|>|~|&|\|/,
  binarynumber:       /b[0-1]+/,
  integer:       /[0-9]+/,
  semicolon:    /;/,
	time: /[t]/,
  comment:      /\#[^\n]:*/,
  ws:           {match: /\s+/, lineBreaks: true},
});
%}



# Pass your lexer object using the @lexer option
@lexer lexer

main -> _ Statement _                                         {% d => ({ "@lang" : d[1] })  %}

Statement ->
      Expression _ %semicolon _ Statement            {% d => [{ "@spawn": d[0] }].concat(d[4]) %}
      |
      Expression                                      {% d => [{"@sigOut": { "@spawn": d[0] }}] %}
      # | %hash . "\n"                                          {% d => ({ "@comment": d[3] }) %}

Expression ->

Term _ %opand _ Term {%d=>{d[0]}%}
| Term _ %operator _ Term {%d=>id%}

Term -> %paramBegin Expression %paramEnd | Expression | Number | %time

Number -> %integer
#| BinaryNumber

#BinaryNumber -> %binarynumber
#| %binarynumber _ %binRangeBegin _ %integer _ %binRangeEnd

# Whitespace

_  -> wschar:*                                                {% function(d) {return null;} %}
__ -> wschar:+                                                {% function(d) {return null;} %}

wschar -> %ws                                                 {% id %}
