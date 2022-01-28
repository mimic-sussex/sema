importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js");
____
//route the test data into the model

var w = 0;
input = (x,id) => {
	console.log(">toModel:   "+[id,x]);
	let p = test(x);
	output(p, 0);
};
