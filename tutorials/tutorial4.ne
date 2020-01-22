
# b0101 >> 10
@{%
const lexer = moo.compile({
  binarynumber:       /b[0-1]+/,
	sep: /,/,
	ob: /{/,
	cb: /}/
});
%}



# Pass your lexer object using the @lexer option
@lexer lexer

main ->    Statement   {% d => ({ "@lang" : d[0] })  %}

Statement -> NumberList {% d => ({ "@numlist" : d[0] })  %}

NumberList -> %binarynumber  {% d => ({ "@bin" : d[0] })  %}
| NumberList  %sep %binarynumber {% d => [d[0]].concat ({ "@bin" : d[2] })  %}
