"use strict";
// import * as tf from "@tensorflow/tfjs";  // Can not use it this way, only through import scripts
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
importScripts("./lalolib.js");
importScripts("./svd.js");
importScripts("./mlworkerscripts.js");
// importScripts("./ringbuf.js");
//importScripts("https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.15/lodash.js");
// import "./magenta/magentamusic.js";




// let a = tf.tensor([100]);
var geval = eval; // puts eval into global scope https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
geval("var input = (value, channel) => {}");
geval("var output = (value,channel) => {postMessage({func:'data', val:value, ch:channel});}");
geval(`

var outputSABs = {};
class MLSABOutputTransducer {
  constructor(bufferType, channel, blocksize) {
    this.channel = channel;
    this.blocksize = blocksize;

    //check for existing channels
    if (channel in outputSABs && outputSABs[channel].blocksize == blocksize) {
      //reuse existing
      this.ringbuf = outputSABs[channel].rb;
    }else{
      //create a new SAB and notify the receiver
      this.sab = RingBuffer.getStorageForCapacity(32 * blocksize, Float64Array);
      this.ringbuf = new RingBuffer(this.sab, Float64Array);
      outputSABs[channel] = {rb:this.ringbuf, sab:this.sab, created:Date.now(), blocksize:blocksize};

      postMessage({
        func: 'sab',
        value: this.sab,
        ttype: bufferType,
        channelID: channel,
        blocksize:blocksize
      });
    }
  }

  send(value) {
    if (this.ringbuf.available_write() > 1) {
      if (typeof(value) == "number") {
        this.ringbuf.push(new Float64Array([value]));
      }else{
        if (value.length == this.blocksize) {
          this.ringbuf.push(value);
        }else if (value.length < this.blocksize) {
          let newVal = new Float64Array(this.blocksize);
          for(let i in value) newVal[i] = value[i];
          this.ringbuf.push(newVal);
        }else{
          this.ringbuf.push(value.slice(0,this.blocksize));
        }
      }
    }
  }

}

var createOutputChannel = (id, blocksize) => {
  return new MLSABOutputTransducer('ML', id, blocksize);
};
var loadResponders = {};
var inputSABs={};
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
            "func": "envload",
            "name": name,
            "storage":"local"
        }
      )
    },
    saveToPB: () => {
      postMessage({
            "func": "envsave",
            "storage":"pastebuffer"
        }
      )
    },
    loadGist: (gistid) => {
      postMessage({
            "func": "envload",
            "name": gistid,
            "storage":"gist"
        }
      )
    },

  },
  //run in the DOM
  domeval: (code) => {
    postMessage({
          "func": "domeval",
          "code": code,
      }
    )
  },
  peerinfo: () => {
    postMessage ({
      "func": "peerinfo"
    });
    console.log("Your peer ID has been copied to the paste buffer")
  }
};
`);

onmessage = m => {

  // console.log('DEBUG:ml.worker:onmessage');
  // console.log(m);

  if (m.data.eval !== undefined) {
    try {
      let evalRes = geval(m.data.eval);
      // if (evalRes != undefined) { //you need to see when things are undefined
        console.log(evalRes);
      // } else
        // console.log("done");
    } catch (e) {
      console.log(`Code eval exception: ${e} `, m.data.eval);
    }
  } else if ("val" in m.data) {
    // console.log("DEBUG:ml.worker:onmessage:val");
    let val = m.data.val;
    // console.log(val);
    val = JSON.parse(`[${val}]`);
    // console.log(val);
    // console.log(loadResponders);
    loadResponders[m.data.name](val);
    delete loadResponders[m.data.name];
  } else if (m.data.type === "model-input-data") {
    input(m.data.value, m.data.ch);
  } else if (m.data.type === "model-input-buffer") {
    console.log("buf received", m);
    let sab = m.data.value;
    let rb = new RingBuffer(sab, Float64Array);
    inputSABs[m.data.channelID] = {
      sab: sab,
      rb: rb,
      blocksize: m.data.blocksize
    };
    console.log("ML", inputSABs);
  }
  // else if(m.data.type === "model-output-data-request"){
  // 	postMessage({
  // 		func: "data",
  // 		worker: "testmodel",
  // 		value: output(m.data.value),
  // 		tranducerName: m.data.transducerName
  // 	});
  // }
};

function sabChecker() {
  try {
    // console.log(SABs);
    for (let v in inputSABs) {
      let avail = inputSABs[v].rb.available_read();
      // console.log(avail, inputSABs[v].rb.capacity, inputSABs[v].blocksize);
      if (avail != inputSABs[v].rb.capacity && avail > 0) {
        for (let i = 0; i < avail; i += inputSABs[v].blocksize) {
          let val = new Float64Array(inputSABs[v].blocksize);
          inputSABs[v].rb.pop(val);
          // console.log(val);
          input(v, val);
        }
      }
    }
    setTimeout(sabChecker, 100);
  } catch (error) {
    console.log(error);
    setTimeout(sabChecker, 100);
  }
}

sabChecker();
