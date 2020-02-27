////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED
////////////////////DEPRECATED

import * as nearley from 'nearley/lib/nearley.js';
import * as compiled from './defaultParser.js';

 import { grammarCompiled, parser } from "../store.js";


import IRToJavascript from '../IR/IR.js';

// let parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammarCompiled));

let parserStartPoint = parser.save();
console.log('Nearley parser loaded')

var ts = 0;

onmessage = (m) => {
   // console.log(m.data);

  if (m.data !== undefined) {
    try {
      parser.feed(m.data);
      // console.log(parser.results)
      postMessage({
        "treeTS": 1
      });
      // console.log(JSON.stringify(parser.results));

      let jscode = IRToJavascript.treeToCode(parser.results); // Get the Abstract Syntax Tree from the parser results and synthesize Javascript
      jscode.paramMarkers = JSON.stringify(jscode.paramMarkers);
      // console.log(jscode);
      postMessage(jscode);


    } catch (err) {
      console.log("Error" + err); // "Error at character 9"
    }
  }
  parser.restore(parserStartPoint);
};
