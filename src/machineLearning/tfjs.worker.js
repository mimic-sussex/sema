"use strict";
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");

// let a = tf.tensor([100]);
var geval = eval; // puts eval into global scope https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
geval("var next = () => {return 0;}");

onmessage = (m) => {
  if ('eval' in m.data) {
    let evalRes = geval(m.data.eval);
    // let evalRes = Function(`return (${m.data.eval})`)();
      console.log(evalRes);
  } else {
    // let freq = a.dataSync()[0];
    postMessage({
      worker: 'testmodel',
      val: next()
    });
    // a = tf.add(a, tf.scalar(10));
  }
};
