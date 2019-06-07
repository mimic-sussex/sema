import IRToJavascript from './IR.js'

onmessage = (m) => {
  // let jscode = IRToJavascript.treeToCode(ASTree);
  console.log("Worker parsing IR:" + m.data);
  let tree = JSON.parse(m.data);
  let jscode = IRToJavascript.treeToCode(tree);
  console.log(jscode);
  postMessage(jscode);
};
