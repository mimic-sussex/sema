import nearley from "nearley";

import compile from "./compiler-low-level";

import {
	ParserRules,
	ParserStart,
	Lexer
} from "nearley/lib/nearley-language-bootstrapped";

import generate from "nearley/lib/generate.js";

import lint from "nearley/lib/lint.js";

function stream() {
	let out = "";
	return {
		write(str) {
			out += str;
		},
		dump() {
			return out;
		}
	};
}

function AnnotatePositions(rules) {
	return rules.map(
		rule =>
			new nearley.Rule(
				rule.name,
				rule.symbols,
				rule.postprocess &&
					((data, ref, reject) => {
						var orig = rule.postprocess(data, ref, reject);
						if (orig === null) return null;
						if (typeof orig == "object" && !orig.slice) {
							orig.pos = ref;
						}
						return orig;
					})
			)
	);
}

export default function compile(grammar) {
	
	let parser = new nearley.Parser( AnnotatePositions(ParserRules), ParserStart, { lexer: Lexer } );

	let errors = stream();
	let output = "";
	let positions = {};

	try {
		parser.feed(grammar);
		if (parser.results[0]) {
			function rangeCallback(name, start, end) {
				positions[name] = [start, end];
			}
			var c = compile(parser.results[0], { rangeCallback: rangeCallback });
			lint(c, { out: errors });

			output = generate(c, "grammar");
		}
	} catch (e) {
		errors.write(e);
	}

	return {
		errors: errors.dump(),
		positions,
		output
	};
}

export function get_exports(source) {
	let module = { exports: "" };
	eval(source);
	return module.exports;
}
