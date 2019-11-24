import nearley from 'nearley';
import mooo from 'moo';

function getParserModuleExports(source) {
	let moo = mooo;
	let module = { exports: '' };
	eval(source);
	return module.exports;
}

/*
 * [NOTE:FB] Can you believe this bug?! Data is a global variable from Webpack and its making this worker run dry!!
 * onmessage = function({ data }) {
*/
onmessage = function(message) {
  if (
		message.data !== undefined &&
		message.data.length != 0 &&
		message.data.type !== "webpackWarnings" &&
		message.data.type !== "webpackClose"
	) {
		try {
			let parserOutputs = [];
			const { liveCodeSource, parserSource } = message.data;
			let parser = new nearley.Parser(getParserModuleExports(parserSource));
			console.log("DEBUG:workerParser:onmessage:parser");
			console.log(parser);			
      parser.feed(liveCodeSource);
			parserOutputs = JSON.parse(JSON.stringify(parser.results));
			console.log("DEBUG:workerParser:onmessage:parserOut");
			console.log(parserOutputs);      
			postMessage(parserOutputs);
		} catch (e) {
			console.log("DEBUG:workerParser:onmessage:catch");
			console.log(e);
      postMessage(e);
		}
	}
};
