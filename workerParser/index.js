import nearley from 'nearley';
import mooo from 'moo';

function getParserModuleExports(source) {
	let moo = mooo;
	let module = { exports: '' };
	eval(source);
	return module.exports;
}

onmessage = function({ data }) {
	let outputs = [];

	const { test, source } = data;

	try {
    let parser = new nearley.Parser(getParserModuleExports(source));
    parser.feed(test);
    outputs = parser.results;
    outputs = JSON.parse(JSON.stringify(outputs));
	} catch (e) {
		console.log(e);
	}

	postMessage(outputs);
};
