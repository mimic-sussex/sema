import App from './UI/App.svelte';
const app = new App({
	target: document.body,
	props: {
		name: "world",
		liveCode: `:b:{{1,0.25}imp}\909b; :s:{{1,0.5}imp}\909; :c:{{{1,0.66}imp,{1,0.8}imp}add}\909closed; :o:{{0.25,0.75}imp}\909open; :tri:{30}tri; :sin:{200}sin; :saw:{4}saw; {:tri:,:saw:,{:sin:,0.4}mul, :o:, :s:, :b:, :c:}mix`,
		grammarCode: `//js //create the model var model = tf.sequential(); model.add(tf.layers.dense({ units: 1, inputShape: [1] })); model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' }); //set up the training data set var xs = tf.tensor2d([0, 1, 2, 3, 4, 5], [6, 1]); var ys = tf.tensor2d([0, 50, 100, 150, 200, 250], [6, 1]); //train the model on the data set model.fit(xs, ys, { epochs: 50 }).then(result => {console.log(\`Model trained\`); console.log(result)}); //defining the callback for testing the model on new data var test = (x) => { return model.predict(tf.tensor2d([x], [1, 1])).dataSync()[0]; } __________ //route the test data into the model var w = 0; input = (id,x) => {console.log(">toModel: "+[id,x]); w=x}; __________ //route the model predictions back to the live coding environment output = (x) => {p = test(w);console.log(">fromModel: "+p); return p;}`
	}
});

window.app = app;

export default app;