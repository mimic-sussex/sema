


/*
  *
    Dynamic sample loading
  *
  */
const getSamplesNames = () => {
	const r = require.context("../../assets/samples", false, /\.wav$/);

	// return an array list of filenames (with extension)
	const importAll = r => r.keys().map(file => file.match(/[^\/]+$/)[0]);

	return importAll(r);
};

/* 
  * Webpack Magic Comments 
     webpackMode: "lazy" // Generates a single lazy-loadable chunk that can satisfy all calls to import(). 
     (default): Generates a lazy-loadable chunk for each import()ed module.
  *
  * webpackMode: "lazy-once" 
  */
let lazyLoadSample = (sampleName, sample) => {
	import(
		/* webpackMode: "lazy" */
		`../../assets/samples/${sampleName}`
	)
	.then(sample =>
		window.AudioEngine.loadSample(sampleName, `samples/${sampleName}`)
	)
	.catch(err => console.error(`ERROR:Main:lazyLoadImage: ` + err));
};

let loadImportedSamples = () => {
	let samplesNames = getSamplesNames();
	// console.log("DEBUG:sampleLoader:getSamplesNames: " + samplesNames);
	samplesNames.forEach(sampleName => {
		lazyLoadSample(sampleName);
	});
};

export { loadImportedSamples };