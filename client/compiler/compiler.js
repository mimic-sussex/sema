/*
  MIT License
  Copyright (c) 2019 Guillermo Webster
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import nearley from "nearley";

import compileLowLevel from "./compiler-low-level";

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
			var c = compileLowLevel(parser.results[0], {
				rangeCallback: rangeCallback
			});
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
