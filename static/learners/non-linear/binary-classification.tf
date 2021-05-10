importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js");
___
//js - Three-layer model for binary classification (tfjs)

var model = tf.sequential();
model.add(tf.layers.dense({
  inputShape: [1],
  units: 100,
  activation: 'sigmoid'
}));
model.add(tf.layers.dense({ units: 100, activation: 'sigmoid' }));
model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
model.compile({
  optimizer: 'adam',
  loss: 'binaryCrossentropy',
  metrics: ['accuracy']
});

//set up the training data set
var xs = tf.tensor2d([-1, 0, 1, 2, 3, 4], [6, 1]);
var ys = tf.tensor2d([1, 0, 1, 0, 0, 1], [6, 1]);

//train the model on the data set
model.fit(xs, ys, { epochs: 50 }).then( result => {
  console.log(`DEBUG:ml.model: Model trained`); console.dir(result)
});

//define the callback for testing the model on new data
var test = (x) => {
  return model.predict(tf.tensor2d([x], [1, 1])).dataSync()[0];
}

___
//route the test data into the model

var w = 0;
var w = 0;
input = (x,id) => {
	console.log(">toModel:   "+[id,x]);
	let p = test(x);
	output(p, 0);
};
