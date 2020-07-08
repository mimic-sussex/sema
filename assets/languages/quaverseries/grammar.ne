# GRAMMAR EDITOR

# Lexer [or tokenizer] definition with language lexemes [or tokens]
@{%
	const lexer = moo.compile({
		ref:  /~[a-zA-Z0-9]+|#[a-zA-Z0-9]+/,
		colon: /:/,
		ws: { match: /\s/, lineBreaks: true},
		name:  /[a-zA-Z][a-zA-Z0-9]*/,
		num: /[0-9]?.?[0-9]+/,
		next: />>/,
		lineSep: /;\n*/,
		comment: /\/\/[^\n]+/
	})
%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)

main -> _ Statement _
{%
d => {

console.log(d[1], "main")

	let tracks = d[1].filter(
		v =>v["@setvar"]["@varname"].includes("#")
	).map( (varObj) => {
		console.log("***name***", varObj)
		return sema.getvar(varObj["@setvar"]["@varname"])
	})
	
	console.log("d1***",d[1])
	console.log("tracks is filted d1", tracks)
	
	let sum = sema.synth("sum", tracks)
	let dac = { '@spawn': sema.synth('dac', [sum]) }
	let setvar = d[1].map( setvarObj => ({'@spawn': setvarObj}) );
	console.log("setvar", setvar)
	console.log("dac", dac)
	let lang = [...setvar, dac]
	console.log("lang", lang)
	return {"@lang": lang}
}
%}

Statement -> Block:+

{%

d => {

console.log(d, "***Statement***");
return d[0]

}
%}

Block -> (%comment _):* Ref _ Chain _ lineSep _ %comment:*

{%
d => {

	console.log(d, "***Block******");
	let name = d[1].value;
	let value = d[3][0];
	let setval = sema.setvar(name, value)
	return setval
}
%}

Ref -> ref %colon

{%
d => d[0]
%}

Chain -> Function | Function _ %next _ Chain

{%
d => {
	console.log(d, "***Chain******");
	let left = d[0]
	let rightChain = d[4]
	console.log("rightChain",rightChain)
	rightChain[0]["@sigp"]["@params"].unshift(left)
	return rightChain
}
%}

Function -> name _ Paras

{%
d => {
	console.log(d, "***Func******");
	let name = d[0];
	let params = d[2];
	params = params.map((para)=>{
		let p = para[0]
		return p.value.includes("~")?						sema.getvar(p.value):sema.num(parseFloat(p.value))
	})
	let s = sema.synth(name[0].value, params)
	return s
}
%}

Paras -> parameter | parameter _ Paras

{%
d => {
	console.log(d, "***Paras******");
	let rightPara = d[2]
	let left = d[0]
	rightPara.unshift(left)
	return rightPara
}
%}


lineSep -> %lineSep

{%
d => null
%}

name -> %name
{%
d => {
return d
}
%}

parameter -> ref | num
{%
d => d[0]
%}

num -> %num
{%
d => d
%}

ref -> %ref

{%
d => d[0]
%}

# Whitespace

_  -> wschar:*
{% function(d) { return null; } %}

__ -> wschar:+
{% function(d) { return null; } %}

wschar -> %ws
{% id %}
