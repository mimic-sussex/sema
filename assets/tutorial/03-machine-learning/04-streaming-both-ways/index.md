# Data Streams: Sending data in both directions

In this tutorial, you will need to open the JavaScript console.  You can do this in Chrome by opening the 'Developer Tools' (F12 key) and choosing the console tab.

As we move towards our first example using machine learning models, we need to think about how to process data from the audio engine with JavaScript and send it back to control sound.  Let's start with simple example:

LC:
```
//8-bit style synthesis
:baseFreq:{{2}clt,[1],[50,100,200,150]}rsq;
{{20}clt, 0, :baseFreq:}toJS;

:arpFreq:{{80}clt, [1], [50,4000,300,500]}rsq;
:freq:{{0}fromJS,:arpFreq:}add;
>{:freq:}sqr;

```

JS:

```
var channel0 = createOutputChannel(0, 1);

____

input = (id,x) => {
	console.log(id, x);
	//change this line to manipulate the frequency
	channel0.send(x[0] + 40);
};

____

```
The base frequency is sent to the JS window, where it is processed and sent back to the LC window. You can change it manually here, or later, perhaps get a machine learning model to learn how to change it.


## Spectral processing in the JS window

LC:
```
//random control signal to slice a sample
:n:{1}noiz;
:p:{3}imp;
:x:{:p:,:n:}|click;
//fft analysis
:m:{:x:, 512, 0.25}fft;
:trig:{:m:,0}at;
:freqs:{:m:,1}at;
:phases:{:m:,2}at;
//send the fft data to the JS window
{:trig:, 0, :freqs:, 512}toJS;

//receive the processed spectrum and play it
>{:trig:, {1, :trig:}fromJS, :phases:, 512, 0.25}ifft;
```

JS:
```
//evaluate the first two blocks in this window before starting the live code window code

var ch = createOutputChannel(1, 512);

___

input = (id,x) => {
	//the fft bins are in the array x
	//do a frequency shift
	let shift=50;
	for(i in x) {
		if (i > shift) {
			x[i] = x[i-shift]
		}
	}
	for(let i=0; i < shift; i++) {
		x[i] = 0;
	}
	ch.send(x);
	//console.log(x);
};
_____

//cancel the callback function, and freeze the bins
input = (id,x) => {};


____
```
