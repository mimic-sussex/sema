"use strict";
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
importScripts("http://mlweb.loria.fr/lalolib.js");
// import "./magenta/magentamusic.js";

// let a = tf.tensor([100]);
var geval = eval; // puts eval into global scope https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
geval("var input = (id,x) => {}");
geval("var output = (x) => {return 0;}");
geval(`
var loadResponders = {};
var sema = {
  saveF32Array: (name, val) => {
    postMessage({
      "func": "save",
      "name": name,
      "val": val
    });
    return 0;
  },
  loadF32Array: (name, onload) => {
    postMessage({
      "func": "load",
      "name": name,
    });
    loadResponders[name] = onload;
    return 0;
  },
  download: (name) => {
    postMessage({
      "func": "download",
      "name": name,
    });
  },
  sendCode: (code) => {
    postMessage({
      "func": "sendcode",
      "code": code,
    });
  }

};
`);

onmessage = m => {

  console.log('DEBUG:ml.worker:onmessage');
  console.log(m); 

	if ("eval" in m.data) {
		let evalRes = geval(m.data.eval);
		if (evalRes != undefined) {
      console.log('DEBUG:ml.worker:onmessage:eval'); 
      console.log(evalRes);
    }
		else 
    console.log("0");
	} else if ("val" in m.data) {
    console.log("DEBUG:ml.worker:onmessage:val");
		let val = m.data.val;
		console.log(val);
		val = JSON.parse(`[${val}]`);
		console.log(val);
		console.log(loadResponders);
		loadResponders[m.data.name](val);
		delete loadResponders[m.data.name];
	} else {
		//     console.log(m.data.rq);
		if (m.data.type === "model-input-data") {
			input(m.data.id, m.data.value);
		} else {
			//receive request
			postMessage({
				func: "data",
				worker: "testmodel",
				val: output(m.data.value),
				tname: m.data.tname
			});
		}
	}
};
