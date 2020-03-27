"use strict";
// import * as tf from "@tensorflow/tfjs";  // Can not use it this way, only through import scripts
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
// importScripts("http://mlweb.loria.fr/lalolib.js");
importScripts("./lalolib.js");
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
  },
  pbcopy: (msg) => {
    postMessage({
      "func": "pbcopy",
      "msg": msg,
    });
  },
  sendBuffer: (bufferName,data) => {
      postMessage({
          "func": "sendbuf",
          "name": bufferName,
          "data": data
      });
  },
  env: {
    saveLocal: (name) => {
      postMessage({
            "func": "envsave",
            "name": name,
            "storage":"local"
        }
      )
    },
    loadLocal: (name) => {
      postMessage({
            "func": "envsave",
            "name": name,
            "storage":"local"
        }
      )
    }

  },
  //run in the DOM
  domeval: (code) => {
    postMessage({
          "func": "domeval",
          "code": code,
      }
    )
  }
};
`);

onmessage = m => {

  // console.log('DEBUG:ml.worker:onmessage');
  // console.log(m);

	if (m.data.eval !== undefined) {
    try {
  		let evalRes = geval(m.data.eval);
  		if (evalRes != undefined) {
        console.log(evalRes);
      }
  		else console.log("done");
    }catch(e) {
      console.log(`Code eval exception: ${e}`);
    }
	}
  else if ("val" in m.data) {
    // console.log("DEBUG:ml.worker:onmessage:val");
		let val = m.data.val;
		// console.log(val);
		val = JSON.parse(`[${val}]`);
		// console.log(val);
		// console.log(loadResponders);
		loadResponders[m.data.name](val);
		delete loadResponders[m.data.name];
	}
  else if (m.data.type === "model-input-data") {
    input(m.data.id, m.data.value);
  }
  else if(m.data.type === "model-output-data-request"){
		postMessage({
			func: "data",
			worker: "testmodel",
			value: output(m.data.value),
			tranducerName: m.data.transducerName
		});
	}
};
