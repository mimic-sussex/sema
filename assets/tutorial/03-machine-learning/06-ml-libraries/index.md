# External Libraries in the Machine Learning Window

Sema allows you to dynamically load JavaScript libaries for machine learning.

Tensorflow.js is great for our purposes here. It's a really flexible library, and it can use you GPU for really fast processing.
All tfjs functions are prefixed with 'tf'

More details here:

https://github.com/tensorflow/tfjs
https://js.tensorflow.org/api/latest/

There are some excellent examples available:

https://github.com/tensorflow/tfjs-examples

A quick example:
```
//:::1::: RUN THIS BLOCK OF CODE FIRST, THEN SCROLL DOWN TO STEP 2

importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js");
____
//:::2:::

var model = tf.sequential();
model.add(tf.layers.dense({units: 1, inputShape: [1]}));

// Prepare the model for training: Specify the loss and the optimizer.
model.compile({loss: 'meanSquaredError', optimizer: 'sgd'});

// Generate some synthetic data for training.
var xs = tf.tensor2d([1, 2, 3, 4], [4, 1]);
var ys = tf.tensor2d([1, 3, 5, 7], [4, 1]);
// Train the model using the data.
model.fit(xs, ys).then(() => {
// Use the model to do inference on a data point the model hasn't seen before:
// Open the browser devtools to see the output
model.predict(tf.tensor2d([5], [1, 1])).print();
});

_____

model.predict(tf.tensor2d([9], [1, 1])).print();
```

<!-- Lalolib is also available.
https://mlweb.loria.fr/lalolab/lalolib.html

Lalolib supplies useful linear algebra functions that aren't present in tensorflow.js.  You can see examples of how it's used in the conceptor and echo state network examples.

```
importScripts("https://mlweb.loria.fr/lalolib.js");
____

let a = ones(10);
mul(a,10)

``` -->

It's also possible to import other javascript libraries.  Code in this window runs in a web worker, which means you can pull in libraries using ImportScripts. For example, the lodash library is very useful for array processing.

```
importScripts('https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.15/lodash.js')

______

//example of use

_.sampleSize([1,2,3,4,5],1)

```
