# Transfer learning with Magenta models

We are starting with transfer learning, a technique that make it trivial for live coders to use machine learning.
In a nutshell, it consists in using pre-trained model off-the-shelf by accessing a configuration that contains all the model parameters.

Google Magenta has made many of these models made available are available online and .

`https://goo.gl/magenta/js-checkpoints`

We are going to explore two model categories: Recurrent Neural Networks and Music Variational Autoencoders to generates sequences that can be played in Sema.

For that we are going to receive messages containing sequences of notes from the Javascript scope which we can then use to generate audio. So, let's start by copying and pasting the following code to the live code editor:

```
{120, 4}clk;
{1}quantise;

:m:{1}fromJS;
:seq:{{15}clp, [1], :m:}rsq;
:tune:{:seq:}saw;
>{{:tune:,0.08}mul}mix;
```

## Part 1: Transfer learning with Recurrent Neural Networks

In the first part of the tutorial, we will be exploring how to use a pre-trained Recurrent Neural Network (RNN) for melody generation.

The specific model configuration (basic_rnn) applies language modeling technique (one-hot encoding) to represent extracted melodies as input to the LSTM model for for melody generation.

For training, all examples are transposed to the MIDI pitch range [48, 84]. Inputs and outputs should also be in this range.

We can use a NoteSequence data object with MIDI notes as model input, and call `continueSequence` so that it generates a continuation sequence in the same style.

```
//EXECUTE THESE SCRIPTS TO IMPORT TENSOR FLOW AND MAGENTA LIBRARIES

importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.4.0/dist/tf.min.js");
importScripts("https://cdn.jsdelivr.net/npm/@magenta/music@^1.12.0/es6/core.js");
importScripts("https://cdn.jsdelivr.net/npm/@magenta/music@^1.12.0/es6/music_rnn.js");
___

// CREATE A CHANNEL TO THE AUDIO ENGINE
var channel0 = createOutputChannel(1, 12);

// MIDI TO FREQUENCY AUXILIARY FUNCTIONS
var mtof = m => Math.pow(2, (m - 69) / 12) * 440;

var ftom = f => Math.round(12*Math.log2(f/440) + 69);
___

// DEFINE A NOTE SEQUENCE E.G. "Piano Phase" Steve Reich
var noteSeq = {
  notes: [
    {pitch: 73, startTime: 0.0, endTime: 0.5},
    {pitch: 75, startTime: 0.5, endTime: 1.0},
    {pitch: 80, startTime: 1.0, endTime: 1.5},
    {pitch: 82, startTime: 1.5, endTime: 2.0},
    {pitch: 83, startTime: 2.0, endTime: 2.5},
    {pitch: 75, startTime: 2.5, endTime: 3.0},
    {pitch: 73, startTime: 3.0, endTime: 4.0},
    {pitch: 82, startTime: 4.0, endTime: 4.5},
    {pitch: 80, startTime: 4.5, endTime: 5.0},
    {pitch: 75, startTime: 5.0, endTime: 5.5},
    {pitch: 83, startTime: 5.5, endTime: 6.0},
    {pitch: 82, startTime: 6.0, endTime: 6.5}
  ],
  totalTime: 12
};

// FETCH AND INITIALIZE A MAGENTA PRE-TRAINED RNN MODEL
var music_rnn = new music_rnn.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn')

music_rnn.initialize()
___

// SEND ORIGINAL NOTE SEQUENCE TO PLAY IN THE ENGINE
const orignalNotes = noteSeq.notes.map(d => mtof(d.pitch))
console.log(orignalNotes);
channel0.send(orignalNotes);
___


// RNN CONTINUES SEQUENCE IN THE STYLE OF ORIGINAL NOTE SEQUENCE
(() => {

	//quantize note sequence (stepsPerQuarter 4)
	const qns = core.sequences.quantizeNoteSequence(noteSeq, 4)
	//length of response for continuation of the melody.
	let rnnSteps = 12;
	//distance to original melody
	//temperature directly proportional to randomness
	let rnnTemperature = 1000

	music_rnn
	.continueSequence(qns, rnnSteps, rnnTemperature)
	.then( sample => {
		const notes = sample.notes.map(d => mtof(d.pitch));
		channel0.send(notes);
		console.log(notes);
	});
})();
___
```

## Part 2: Transfer learning with Music Variational Autoencoder

A Music Variational Autoencoder (VAE) is a machine learning model that has previously been trained on a lot of MIDI files, and has learned to generate melodies or ensembles.

VAE represents each music sample as a vector of 256 features, and every different vector of 256 numbers sounds like a different piece of music.

These latent vectors enable a set of latent space operations including sampling, interpolation, and attribute vector arithmetic.



```
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.4.0/dist/tf.min.js");
importScripts("https://cdn.jsdelivr.net/npm/@magenta/music@^1.12.0/es6/core.js");
importScripts("https://cdn.jsdelivr.net/npm/@magenta/music@^1.12.0/es6/music_vae.js");

___

var mvae,
		currentSample;

const MELODY_BARS = 2;
const MELODY_DIMS = [73,135,230,177,38,208,172,56,212,211,140,142,150,1,202,74,33,187,206,14,154,2,31,32,244,24,183,173,64,3,108,196,132,29,75,156,131,26,237,164,200,48,218,44,113,167,250,166,90,77,23,185,246,180,217,10,111,213,46,127,216,117,128,16,222,243,240,233,70,9,88,236,179,40,94,4,182,241,78,165,125,25,103,81,66,83,91,124,105,226,247,145,68,238,69,47,254,153,119,5,255,170,158,176,84,225,186,43,99,245,224,168,45,160,63,49,37,61,35,101,141,41,248,209,134,149,147,30,110,188,118,52,67,133,92,95,126,112,15,93,157,107,55,60,130,235,231,6,123,171,114,20,139,162,199,86,51,120,227,85,152,178,80,184,39,215,22,138,192,57,155,252,198,13,50,181,8,121,148,193,204,36,251,219,0,97,220,229,109,21,194,159,72,122,146,87,42,102,189,65,115,253,19,163,201,207,137,100,27,242,34,203,129,210,11,54,232,12,28,98,71,18,205,17,79,249,197,221,223,234,106,76,175,239,136,53,58,89,191,82,190,59,62,174,214,96,161,195,151,116,143,7,104,169,144,228];


var channel0 = createOutputChannel(1, 8);

// midi to frequency
function mtof(midinote) {
	return Math.pow(2, (midinote - 69) / 12) * 440;
}


// get a new random sequence
async function sequence() {

	const randZs = tf.tidy(() =>
		tf.randomNormal([1, mvae.decoder.zDims])
	);
	currentSample = (await mvae.decode(randZs, 0.5))[0];

	const notes = currentSample.notes.map(d => mtof(d.pitch) )
	channel0.send(notes, 1);
	console.log(notes)
}

mvae = new music_vae.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_small');

mvae.initialize()
	.then( () => { console.log(sequence())
								 console.log("model-loaded") });
___

// Evaluate this block to generate new sequences

sequence();
___

var	midime;

midime = new mm.MidiMe({ epochs: 100 });
midime.initialize();
___
```


