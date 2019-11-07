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

    console.log("Test");
  	console.log(source);
  	// console.log(test);
    let parser = new nearley.Parser(getParserModuleExports(source));


    console.log("Parser");
    console.log(parser);
    parser.feed(test);
    outputs = parser.results;


    console.log("Results");
    console.log(outputs);
    outputs = JSON.parse(JSON.stringify(outputs));
	} catch (e) {
		console.log(e);
	}

	postMessage(outputs);
};
