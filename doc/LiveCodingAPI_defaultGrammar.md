# The Sema System

The code examples below work for *one* sematic language, the default demo language. To run these commands, paste them in the top window and hit cmd+enter. That will evaluate the line. To evaluate many lines, you need to separate them with a semicolon ";" after every line.

There are two windows in the sema system. The top one is the sematic window for the unique language. The bottom one is a window for JavaScript code, where we, for example, run machine learning models.


# oscillators

first argument is always the frequency, the last argument the phase.

// sine

`{500}sin`
`{500,0.2}sin`

// saw

`{500}saw`

// triangle

`{500}tri`

// phasor

`{500}pha`

// phasor with start and end phase

`{500,0.3,0.8}ph2`

// square

`{500}sqr`

// pulse (second argument is pulsewidth)

`{500,0.7}pul`

// impulse (single impulse, useful for triggering)

`{2}imp`
`{2,0.2}imp`


// saw negative

`{500}sawn`

# noise

argument is the amplitude

`{0.8}noiz`

# control

//sample and hold

`{{{{0.1}pha,40,1000}ulin,500}sah}saw`

# envelope

The envelope is an adsr envelope, so the arguments are "input signal", attack (in ms), decay (in ms), sustain level (0-1), release (in ms). So here with a square wave as input:

`{{1}sqr,10,200,0.05,200}env`

multiplied with a sine wave:

`{{500}sin,{{1}sqr,10,200,0.05,200}env}mul`

With a pulse wave as trigger:

`{{500}sin,{{1,0.8}pul,10,200,0.05,200}env}mul`

Note that the pulse starts at -1, so higher pulse widths give shorter envelopes (gate is open shorter), and they start after the low level of the pulse. You can solve this by multiplying the pulse with -1.

`{{500}sin,{{{1,0.8}pul,-1}mul,10,200,0.05,200}env}mul`


# audio input


`{0}adc`

# sample playback

Play a sample:

`{1}\909open`

These are preloaded when the audio engine starts up, look at the filenames at the top of the console window to see what is there.

Repeat:

`{{1}sqr}\909open`

With some rhythm:

`{{{1}sqr,{5}saw}add}\909open`


# filters

// lowpass: arguments are "input signal" and a cutoff factor between 0 and 1. The function implemented internally is: `output=outputs[0] + cutoff*(input-outputs[0]);`

`{{500}saw,0.1}lpf`


// hipass: arguments are "input signal" and a cutoff factor between 0 and 1. The function implemented internally is: `output=input-(outputs[0] + cutoff*(input-outputs[0]));`


`{{500}saw,0.1}hpf`

// lowpass with resonance: first argument is input, then cuttof freq in Hz. res is between 1 and whatever.

`{{500}saw,800,10}lpz`


// hipass with resonance: first argument is input, then cuttof freq in Hz. res is between 1 and whatever.

`{{500}saw,3000,20}hpz`


# effects

// distortion: arguments: input, and shape: from 1 (soft clipping) to infinity (hard clipping)
atan distortion, see [atan distortion on musicdsp.org](http://www.musicdsp.org/showArchiveComment.php?ArchiveID=104)

```
{{200}saw,10}dist
{{200}saw,100}dist
{{200}saw,1000}dist
```

// flanger: arguments:

- input signal
- delay = delay time - ~800 sounds good
- feedback = 0 - 1
- speed = lfo speed in Hz, 0.0001 - 10 sounds good
- depth = 0 - 1

`{{200}sqr,200,0.8,2,0.2}flange`

// chorus: arguments:

- input signal
- delay = delay time - ~800 sounds good
- feedback = 0 - 1
- speed = lfo speed in Hz, 0.0001 - 10 sounds good
- depth = 0 - 1

`{{200}sqr,1000,0.9,0.2,0.4}chor`


// delayline: input, delay time in samples, amount of feedback (between 0 and 1)

`{{5}sqr,20000,0.9}dl`


# operators

- `gt` : greater than
- `lt` : less than
- `mod` : modulo
- `add` : add
- `mul` : multiply
- `sub` : substract
- `div` : divide
- `pow` : power of
- `abs` : absolute value

# operators over lists:

Sum signals: (this will clip in this example:)

`{{400}sin,{600}sin,{200}sin}sum`


Mix signals: (sum and divide by length)

`{{400}sin,{600}sin,{200}sin}mix`

so similar to:

`{{{400}sin,{600}sin,{200}sin}sum,3}div`


Multiply signals:

`{{400}sin,{600}sin,{200}sin}prod`


# mapping values

- `blin` : bipolar linear map from range -1,1 to range between arg 2 and arg 3
- `ulin` : unipolar linear map from range 0,1 to range between arg 2 and arg 3
- `bexp` : bipolar exponential map from range -1,1 to range between arg 2 and arg 3
- `uexp` : unipolar exponential map from range 0,1 to range between arg 2 and arg 3

- `linlin` : arbitrary linear map from range between arg 2 and 3, to range between arg 4 and arg 5
- `linexp` : arbitrary exponential map from range between arg 2 and 3, to range between arg 4 and arg 5


# communication to the model (lower editor window)


### Send data to model: 

10 times per second (argument 1) with identifier 0 (argument 2). The third argument is signal to send (in this case the output of `{1}sin`.

`{10,0,{1}sin}toJS`

In js (lower window):

```
input = (id,x) => {console.log([id,x])};

```

### Receive data from model:

`{{10,1}fromJS}saw`

In js (lower window):

```
y=100;
output = (x) => {console.log("in "+x); y++; return y;}
```

Note: to separate the two functions in the model window you use 10 underscores:

```
__________
```

# osc communication

??? how to select data from incoming osc to use in signal chain???

// forward data coming at the osc address `/minibee/data` to the model fifty times per second with ID 2

`{50,2,/minibee/data}toModel`

// receive it in the lower editor

`input = (id,x) => {console.log([id,x])};`

`x` will be an array of values
