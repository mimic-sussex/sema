(function () {
	function id(x) {
		return x[0];
	}

	const lexer = moo.compile({
		separator: /,/,
		paramEnd: /}/,
		paramBegin: /{/,
		listEnd: /\]/,
		listBegin: /\[/,
		dacoutCh: /\>[0-9]+/,
		dacout: /\>/,
		variable: /:[a-zA-Z0-9]+:/,
		sample: {
			match: /\\[a-zA-Z0-9]+/,
			lineBreaks: true,
			value: (x) => x.slice(1, x.length),
		},
		slice: {
			match: /\|[a-zA-Z0-9]+/,
			lineBreaks: true,
			value: (x) => x.slice(1, x.length),
		},
		stretch: {
			match: /\@[a-zA-Z0-9]+/,
			lineBreaks: true,
			value: (x) => x.slice(1, x.length),
		},
		clockTrig: /0t-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
		number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
		semicolon: /;/,
		funcName: /[a-zA-Z][a-zA-Z0-9]*/,
		string: { match: /'[a-zA-Z0-9]+'/, value: (x) => x.slice(1, x.length - 1) },
		comment: /\/\/[^\n]*/,
		ws: { match: /\s+/, lineBreaks: true },
	});

	var grammar = {
		Lexer: lexer,
		ParserRules: [
			{
				name: "main",
				symbols: ["_", "Statement", "_"],
				postprocess: (d) => ({ "@lang": d[1] }),
			},
			{
				name: "Statement",
				symbols: [
					"Expression",
					"_",
					lexer.has("semicolon") ? { type: "semicolon" } : semicolon,
					"_",
					"Statement",
				],
				postprocess: (d) => [{ "@spawn": d[0] }].concat(d[4]),
			},
			{
				name: "Statement",
				symbols: [
					"Expression",
					"_",
					lexer.has("semicolon") ? { type: "semicolon" } : semicolon,
				],
				postprocess: (d) => [{ "@spawn": d[0] }],
			},
			{
				name: "Statement",
				symbols: [
					lexer.has("comment") ? { type: "comment" } : comment,
					"_",
					"Statement",
				],
				postprocess: (d) => d[2],
			},
			{
				name: "Expression",
				symbols: [
					"ParameterList",
					"_",
					lexer.has("funcName") ? { type: "funcName" } : funcName,
				],
				postprocess: (d) => sema.synth(d[2].value, d[0]["@params"]),
			},
			{
				name: "Expression",
				symbols: [
					"ParameterList",
					"_",
					lexer.has("sample") ? { type: "sample" } : sample,
				],
				postprocess: (d) =>
					sema.synth("sampler", d[0]["@params"].concat([sema.str(d[2])])),
			},
			{
				name: "Expression",
				symbols: [
					"ParameterList",
					"_",
					lexer.has("slice") ? { type: "slice" } : slice,
				],
				postprocess: (d) =>
					sema.synth("slice", d[0]["@params"].concat([sema.str(d[2])])),
			},
			{
				name: "Expression",
				symbols: [
					"ParameterList",
					"_",
					lexer.has("stretch") ? { type: "stretch" } : stretch,
				],
				postprocess: (d) =>
					sema.synth("stretch", d[0]["@params"].concat([sema.str(d[2])])),
			},
			{
				name: "Expression",
				symbols: [
					lexer.has("variable") ? { type: "variable" } : variable,
					"_",
					"Expression",
				],
				postprocess: (d) => sema.setvar(d[0], d[2]),
			},
			{
				name: "Expression",
				symbols: [
					lexer.has("dacout") ? { type: "dacout" } : dacout,
					"_",
					"Expression",
				],
				postprocess: (d) => sema.synth("dac", [d[2]]),
			},
			{
				name: "Expression",
				symbols: [
					lexer.has("dacoutCh") ? { type: "dacoutCh" } : dacoutCh,
					"_",
					"Expression",
				],
				postprocess: (d) =>
					sema.synth("dac", [d[2], sema.num(d[0].value.substr(1))]),
			},
			{
				name: "ParameterList",
				symbols: [
					lexer.has("paramBegin") ? { type: "paramBegin" } : paramBegin,
					"Params",
					lexer.has("paramEnd") ? { type: "paramEnd" } : paramEnd,
				],
				postprocess: (d) => ({
					paramBegin: d[0],
					"@params": d[1],
					paramEnd: d[2],
				}),
			},
			{ name: "Params", symbols: ["ParamElement"], postprocess: (d) => [d[0]] },
			{
				name: "Params",
				symbols: [
					"ParamElement",
					"_",
					lexer.has("separator") ? { type: "separator" } : separator,
					"_",
					"Params",
				],
				postprocess: (d) => [d[0]].concat(d[4]),
			},
			{
				name: "ParamElement",
				symbols: [lexer.has("number") ? { type: "number" } : number],
				postprocess: (d) => ({ "@num": d[0] }),
			},
			{
				name: "ParamElement",
				symbols: [lexer.has("string") ? { type: "string" } : string],
				postprocess: (d) => ({ "@string": d[0] }),
			},
			{ name: "ParamElement", symbols: ["Expression"], postprocess: id },
			{
				name: "ParamElement",
				symbols: [lexer.has("variable") ? { type: "variable" } : variable],
				postprocess: (d) => sema.getvar(d[0]),
			},
			{
				name: "ParamElement",
				symbols: [
					lexer.has("listBegin") ? { type: "listBegin" } : listBegin,
					"Params",
					lexer.has("listEnd") ? { type: "listEnd" } : listEnd,
				],
				postprocess: (d) => ({ "@list": d[1] }),
			},
			{ name: "_$ebnf$1", symbols: [] },
			{
				name: "_$ebnf$1",
				symbols: ["wschar", "_$ebnf$1"],
				postprocess: function arrconcat(d) {
					return [d[0]].concat(d[1]);
				},
			},
			{
				name: "_",
				symbols: ["_$ebnf$1"],
				postprocess: function (d) {
					return null;
				},
			},
			{ name: "__$ebnf$1", symbols: ["wschar"] },
			{
				name: "__$ebnf$1",
				symbols: ["wschar", "__$ebnf$1"],
				postprocess: function arrconcat(d) {
					return [d[0]].concat(d[1]);
				},
			},
			{
				name: "__",
				symbols: ["__$ebnf$1"],
				postprocess: function (d) {
					return null;
				},
			},
			{
				name: "wschar",
				symbols: [lexer.has("ws") ? { type: "ws" } : ws],
				postprocess: id,
			},
		],
		ParserStart: "main",
	};
	if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
		module.exports = grammar;
	} else {
		window.grammar = grammar;
	}
})();
