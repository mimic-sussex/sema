import IRToJavascript from './IR.js'

onmessage = (m) => {
  let tree = JSON.parse(m.data);
  let jscode = IRToJavascript.treeToCode(tree);
  postMessage(jscode);
};
