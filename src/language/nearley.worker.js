import * as nearley from 'nearley/lib/nearley.js';
import * as grammar from './eppprocessor.js';
import IRToJavascript from '../IR/IR.js'

var parserStartPoint;
let processor = nearley.Grammar.fromCompiled(grammar);
let parser = new nearley.Parser(processor);
parserStartPoint = parser.save();
console.log('Nearley parser loaded')

function parseEditorInput(input) {
  if (input !== undefined) {
    parser.feed(input);
    return parser.results;
  }
}

onmessage = (m) => {
  console.log(m.data);
  let tree = parseEditorInput(m.data)
  console.log(`Parse tree complete`);
  let jscode = IRToJavascript.treeToCode(tree);
  postMessage(jscode);
  parser.restore(parserStartPoint);
};
