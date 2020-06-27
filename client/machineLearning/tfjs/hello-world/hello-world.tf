// MODEL EDITOR

//js – Linear model for regression (tfjs)

//create the model
var model = tf.sequential();
model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

//set up the training data set
var xs = tf.tensor2d([0, 1, 2, 3, 4, 5], [6, 1]);
var ys = tf.tensor2d([0, 50, 100, 150, 200, 250], [6, 1]);

//train the model on the data set
model.fit(xs, ys, { epochs: 150 }).then(result => {console.log(`DEBUG:ml.model: Model trained`); console.dir(result)});

//defining the callback for testing the model on new data
var test = (x) => { return model.predict(tf.tensor2d([x], [1, 1])).dataSync()[0]; }
__________

//route the test data into the model
var w = 0;
input = (x, id) => {
	console.log(">toModel: "+[id,x]);
	let prediction = test(x);
	console.log('pred: ',prediction);
	output(prediction, 0)
};
