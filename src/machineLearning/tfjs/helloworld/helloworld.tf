//js
var model = tf.sequential();
model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' });

//set up the training data set
var xs = tf.tensor2d([-1, 0, 1, 2, 3, 4], [6, 1]);
var ys = tf.tensor2d([-3, -1, 1, 3, 5, 7], [6, 1]);

//train the model on the data set
model.fit(xs, ys, { epochs: 50 }).then(result => {console.log(`Model trained`); console.log(result)});

//defining the callback for testing the model on new data 
var calc = (x) => { return model.predict(tf.tensor2d([x], [1, 1])).dataSync()[0]; }

__________
//route the test data into the model
var w = 0;
input = (id,x) => {console.log(">toModel: "+[id,x]); w=x};
__________
//route the model predictions back to the live coding environment 
output = (x) => {p = calc(w);console.log(">fromModel: "+p); return p;}


