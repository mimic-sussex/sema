"use strict";
// import * as tf from "@tensorflow/tfjs";  // Can not use it this way, only through import scripts
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
importScripts("./lalolib.js");
importScripts("./svd.js");
// importScripts("./ringbuf.js");
// importScripts("./lodash.js");
// import "./magenta/magentamusic.js";

//BAD PRACTICE WARNING!!!!!!!!
//this should be imported but there are some packaging compatibilities between maxiProcessor and importscripts here that need to be solved.  This code is repeated in utils/ringbuf.js
class RingBuffer {
  static getStorageForCapacity(capacity, type) {
    if (!type.BYTES_PER_ELEMENT) {
      throw "Pass in a ArrayBuffer subclass";
    }
    var bytes = 8 + (capacity + 1) * type.BYTES_PER_ELEMENT;
    return new SharedArrayBuffer(bytes);
  }
  // `sab` is a SharedArrayBuffer with a capacity calculated by calling
  // `getStorageForCapacity` with the desired capacity.
  constructor(sab, type) {
    if (!ArrayBuffer.__proto__.isPrototypeOf(type) &&
      type.BYTES_PER_ELEMENT !== undefined) {
      throw "Pass a concrete typed array class as second argument";
    }

    // Maximum usable size is 1<<32 - type.BYTES_PER_ELEMENT bytes in the ring
    // buffer for this version, easily changeable.
    // -4 for the write ptr (uint32_t offsets)
    // -4 for the read ptr (uint32_t offsets)
    // capacity counts the empty slot to distinguish between full and empty.
    this._type = type;
    this.capacity = (sab.byteLength - 8) / type.BYTES_PER_ELEMENT;
    this.buf = sab;
    this.write_ptr = new Uint32Array(this.buf, 0, 1);
    this.read_ptr = new Uint32Array(this.buf, 4, 1);
    this.storage = new type(this.buf, 8, this.capacity);
  }
  // Returns the type of the underlying ArrayBuffer for this RingBuffer. This
  // allows implementing crude type checking.
  type() {
    return this._type.name;
  }
  // Push bytes to the ring buffer. `bytes` is an typed array of the same type
  // as passed in the ctor, to be written to the queue.
  // Returns the number of elements written to the queue.
  push(elements) {
    var rd = Atomics.load(this.read_ptr, 0);
    var wr = Atomics.load(this.write_ptr, 0);

    if ((wr + 1) % this._storage_capacity() == rd) {
      // full
      return 0;
    }

    let to_write = Math.min(this._available_write(rd, wr), elements.length);
    let first_part = Math.min(this._storage_capacity() - wr, to_write);
    let second_part = to_write - first_part;

    this._copy(elements, 0, this.storage, wr, first_part);
    this._copy(elements, first_part, this.storage, 0, second_part);

    // publish the enqueued data to the other side
    Atomics.store(
      this.write_ptr,
      0,
      (wr + to_write) % this._storage_capacity()
    );

    return to_write;
  }
  // Read `elements.length` elements from the ring buffer. `elements` is a typed
  // array of the same type as passed in the ctor.
  // Returns the number of elements read from the queue, they are placed at the
  // beginning of the array passed as parameter.
  pop(elements) {
    var rd = Atomics.load(this.read_ptr, 0);
    var wr = Atomics.load(this.write_ptr, 0);

    if (wr == rd) {
      return 0;
    }

    let to_read = Math.min(this._available_read(rd, wr), elements.length);

    let first_part = Math.min(this._storage_capacity() - rd, elements.length);
    let second_part = to_read - first_part;

    this._copy(this.storage, rd, elements, 0, first_part);
    this._copy(this.storage, 0, elements, first_part, second_part);

    Atomics.store(this.read_ptr, 0, (rd + to_read) % this._storage_capacity());

    return to_read;
  }

  // True if the ring buffer is empty false otherwise. This can be late on the
  // reader side: it can return true even if something has just been pushed.
  empty() {
    var rd = Atomics.load(this.read_ptr, 0);
    var wr = Atomics.load(this.write_ptr, 0);

    return wr == rd;
  }

  // True if the ring buffer is full, false otherwise. This can be late on the
  // write side: it can return true when something has just been poped.
  full() {
    var rd = Atomics.load(this.read_ptr, 0);
    var wr = Atomics.load(this.write_ptr, 0);

    return (wr + 1) % this.capacity != rd;
  }

  // The usable capacity for the ring buffer: the number of elements that can be
  // stored.
  capacity() {
    return this.capacity - 1;
  }

  // Number of elements available for reading. This can be late, and report less
  // elements that is actually in the queue, when something has just been
  // enqueued.
  available_read() {
    var rd = Atomics.load(this.read_ptr, 0);
    var wr = Atomics.load(this.write_ptr, 0);
    return this._available_read(rd, wr);
  }

  // Number of elements available for writing. This can be late, and report less
  // elements that is actually available for writing, when something has just
  // been dequeued.
  available_write() {
    var rd = Atomics.load(this.read_ptr, 0);
    var wr = Atomics.load(this.write_ptr, 0);
    return this._available_write(rd, wr);
  }

  // private methods //

  // Number of elements available for reading, given a read and write pointer..
  _available_read(rd, wr) {
    if (wr > rd) {
      return wr - rd;
    } else {
      return wr + this._storage_capacity() - rd;
    }
  }

  // Number of elements available from writing, given a read and write pointer.
  _available_write(rd, wr) {
    let rv = rd - wr - 1;
    if (wr >= rd) {
      rv += this._storage_capacity();
    }
    return rv;
  }

  // The size of the storage for elements not accounting the space for the index.
  _storage_capacity() {
    return this.capacity;
  }

  // Copy `size` elements from `input`, starting at offset `offset_input`, to
  // `output`, starting at offset `offset_output`.
  _copy(input, offset_input, output, offset_output, size) {
    for (var i = 0; i < size; i++) {
      output[offset_output + i] = input[offset_input + i];
    }
  }
}

// let a = tf.tensor([100]);
var geval = eval; // puts eval into global scope https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
geval("var input = (value, channel) => {}");
geval("var output = (value,channel) => {postMessage({func:'data', val:value, ch:channel});}");
geval(`
var loadResponders = {};
var SABs={};
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
  		if (evalRes != undefined) {
        console.log(evalRes);
      }
  		else
        console.log("done");
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
    input(m.data.value, m.data.ch);
  }
  else if (m.data.type === "model-input-buffer") {
    console.log("buf received", m);
    let sab = m.data.value;
    let rb =  new RingBuffer(sab, Float64Array);
    SABs[m.data.channelID] = {sab:sab, rb:rb, blocksize: m.data.blocksize};
    console.log("ML", rb);
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
  // console.log(SABs);
  for (let v in Object.keys(SABs)) {
    let avail = SABs[v].rb.available_read();
    // console.log(avail, SABs[v].rb.capacity);
    if (avail != SABs[v].rb.capacity && avail > 0) {
        for (let i=0; i < avail; i++) {
          let val = new Float64Array(SABs[v].blocksize);
          SABs[v].rb.pop(val);
          input(v, val);
        }
    }
  }
  // if (rb) {
  //   console.log("ML", rb.available_read());
  //   let tmp = new Float64Array(1);
  //   rb.pop(tmp);
  //   console.log(tmp);
  // }
  setTimeout(sabChecker, 10); 
}

sabChecker();
