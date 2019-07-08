importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");

// let a = tf.tensor([100]);

var next = () => {return 0;};

onmessage = (m) => {
  if ('eval' in m.data) {
    let evalRes = eval(m.data.eval);
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
