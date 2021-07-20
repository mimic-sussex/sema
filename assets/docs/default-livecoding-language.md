# Default Live Coding Language

The code examples below work for *one* language, the default demo language. To run these commands, paste them in the top window and hit cmd+enter. That will evaluate the line.

# Audio Outputs

To route a signal to the outputs on your soundcard, there are the following options:

### The ```>``` operator

Route a single signal to all outputs, by putting an ```>``` at the point in the signal chain where you want to output e.g.

```
>{50}saw;
```

```
{>{{50}saw, {51}saw}add, 500,3}hpz;
```
In the above example, the soundcard will monitor the saw waves, but not the hpz.


To route a single signal to a single channel, using an asterisk and a channel number.

```
>0 {40}sqr;
>1 {40.4}sqr;
```


### dac

To change channel numbers programmatically, use the `dac` function.

```
//alternate noise between left and right channels
{{1}noiz,{{{0.1}pha,10}mul}sqr}dac;
```

# Audio Input
Arguments:
1. Amplitude

```
//wear headphones!
>{1}adc;
```

```
//inevitable Dalek effect
>{{1}adc, {200}sin}mul;
```

# Oscillators

first argument is always the frequency, the last argument the phase.

### sin

Sine wave

```
>{500}sin;
```
```
>{500,0.2}sin;
```

### saw

Saw wave

```
>{500}saw;
```

## tri

Triangle wave

```
>{500}tri;
```

### pha

Phasor (a ramp that rises from 0 to 1)

```
>{500}pha;
```
### ph2

Phasor with start and end phase

```
>{500,0.3,0.8}ph2;
```

### sqr

Square wave

```
>{500}sqr;
```

### pul

Pulse (the second argument is pulsewidth)

```
>{500,0.7}pul;
```
### imp

Impulse (single impulse, useful for triggering)

```
>{2}imp;
```
```
`>{2,0.2}imp;
```

### sawn

Anti-aliased saw wave

```
>{500}sawn;
```

# Noise

White noise

the argument is the amplitude

```
>{0.8}noiz;
```

# Control

### sah

Sample and hold

Arguments:
1. Input signal
2. Sampling period length (milliseconds)

```
:frequency:{{0.1}pha,40,1000}uexp;
>{{:frequency:,500}sah}saw;
```

# Envelopes

### env

The envelope is an adsr envelope, so the arguments are "input signal", attack (in ms), decay (in ms), sustain level (0-1), release (in ms). So here with a square wave as input:

```
>{{1}sqr,10,200,0.05,200}env;
```

multiplied with a sine wave:

```
>{{500}sin,{{1}sqr,10,200,0.05,200}env}mul;
```

With a pulse wave as trigger:

```
>{{500}sin,{{1,0.8}pul,10,200,0.05,200}env}mul;
```

Note that the pulse starts at -1, so higher pulse widths give shorter envelopes (gate is open shorter), and they start after the low level of the pulse. You can solve this by multiplying the pulse with -1.

```
>{{500}sin,{{{1,0.8}pul,-1}mul,10,200,0.05,200}env}mul;
```

### line

Triggered line generator

Arguments:
1. Trigger
2. Time (ms) to rise from 0 to 1

```
:line:{{1}clt, 100}line;
>{{1}noiz, :line:}mul;
```

# Sample playback

### The ```\```operator

Samples are preloaded when the audio engine starts up. A list of samples can be found in https://github.com/mimic-sussex/sema/tree/master/assets/samples

Play a sample once with a trigger, using ```\``` followed by the sample name.

Arguments:
1. A trigger (positive zero crossing)
2. Speed (1=normal, 2=double etc)
3. Offset

Play once:

```
>{1}\909open;
```


Repeat:
```
>{{1}imp}\909open;
```

With some rhythm:

```
>{{{1}sqr,{5}saw}add}\909open;
```

Changing speed:

```
:speed:{{0.01}pha,3}mul;
>{{1}imp, :speed:}\InsectBee;
```

Playing in reverse:
```
>>{{1}imp, -1, 1}\909;
```

Changing offset:
```
:offset:{0.2}pha;
>{{8}imp, 1, :offset:}\909b;
```

# Sample Slicing


### The ```|``` operator

```
>{{1}imp,0.5}|kernel;
```

This sample player can be used for slicing up breaks etc. When there's a zero crossing in the first parameter, the sample position is set to the second parameter; otherwise the sample just loops.  Put a '|' before the sample name to use this player.

```
>{{2}imp,{{0.3}pha,0.1,0.9}ulin}|kernel;
```

Set the position with a phasor - change the impulse and phasor speeds to vary the patterns.

```
>{{32}imp,{0.1}pha}|kernel;
```

This is kind of like (noisy) timestretching


# Filters

### lpf

One pole low pass:

Arguments:
1. Input signal
2. Cutoff (0-1)

```
>{{500}saw,0.1}lpf;
```

### hpf

One pole high pass:
Arguments:
1. Input signal
2. Cutoff (0-1)

```
>{{500}saw,0.1}hpf;
```
### lpz

Lowpass with resonance:
Arguments:
1. Input signal
2. Cutoff (20-20000)
3. Resonance (1 upwards)

```
>{{500}saw,800,10}lpz;
```

### hpz

High pass with resonance:
1. Input signal
2. Cutoff (20-20000)
3. Resonance (1 upwards)

```
>{{500}saw,3000,20}hpz;
```
### svf

State variable filter
Arguments:

1. Input signal
2. Cutoff frequency (Hz)
3. Resonance
4. Low pass filter amount (0-1)
4. Band pass filter amount (0-1)
4. High pass filter amount (0-1)
5. Notch filter amount (0-1)

```
:osc:{50}saw;
:lfo:{{1}tri, 100, 400}bexp;
>{:osc:, :lfo:, 10, 0, 0.8, 1, 0.9}svf;
```

```
:freqStart:{{}mouseX, 1, 3000}uexp;
:freq:{{16}clp, [1],[50,100,200]}rsq;
:freq:{:freqStart:, :freq:}add;
:env:{{16}clt, 50,300,0.2,40}env;
:osc:{:freq:}saw;
:fenv:{:env:,100,1000}uexp;
:fmod:{{}mouseY,1,3000}uexp;
>{:osc:, {:fenv:, :fmod:}add, 3, 1, 0, 0, 0}svf;
```

# Effects

### dist

// distortion: arguments: input, and shape: from 1 (soft clipping) to infinity (hard clipping)
atan distortion, see [atan distortion on musicdsp.org](http://www.musicdsp.org/showArchiveComment.php?ArchiveID=104)

```
>{{200}saw,10}dist;
```
```
>{{200}saw,100}dist;
```
```
>{{200}saw,1000}dist;
```

### asymclip

Asymmetric wave shaping

Arguments:
1. Input signal
2. The curve shape for values below zero (e.g. 2 = squared, 3 = cubed, 0.5 = square root)
3. The curve shape for values above zero

```
:kick:{{4}clt}\909b;
:curvebelowzero:{{0.14}tri,0.1,3}blin;
:curveabovezero:{{0.1}tri,0.1,3}blin;
>{:kick:, :curvebelowzero:, :curveabovezero:}asymclip;
```


### flange

Flanger

Arguments:

1.input signal
2. delay = delay time (ms)
3. Feedback = 0 - 1
4. Speed = lfo speed in Hz
5. Depth = 0 - 1

```
>{{80}sqr,200,1, 0.1,0.9}flange;
```

### chor

Chorus

Arguments:

1.input signal
2. delay = delay time (ms)
3. Feedback = 0 - 1
4. Speed = lfo speed in Hz
5. Depth = 0 - 1

```
>{{80}sqr,400,0.9, 2,0.9}chor;
```

### dl

Delay line

Arguments:
1. input signal
2. delay time in samples
3. amount of feedback (between 0 and 1)

```
>{{5}sqr,20000,0.9}dl;
```

### freeverb

Reverb

Arguments:
1. Input signal
2. Room size (0-1)
3. Absorption (0-1)

```
:click:{{1}clt,8}\boom2;
:verb:{:click:, 0.9, 0.1}freeverb;
>{:click:,{:verb:,0.1}mul}add;
```


# Operators

- `gt` : greater than
- `lt` : less than
- `mod` : modulo
- `add` : add
- `mul` : multiply
- `sub` : substract
- `div` : divide
- `pow` : power of
- `abs` : absolute value

## Operators over Lists

Sum signals: (this will clip in this example:)

`{{400}sin,{600}sin,{200}sin}sum`


Mix signals: (sum and divide by length)

`{{400}sin,{600}sin,{200}sin}mix`

so similar to:

`{{{400}sin,{600}sin,{200}sin}sum,3}div`


Multiply signals:

`{{400}sin,{600}sin,{200}sin}prod`


# Mapping Values

- `blin` : bipolar linear map from range -1,1 to range between arg 2 and arg 3
- `ulin` : unipolar linear map from range 0,1 to range between arg 2 and arg 3
- `bexp` : bipolar exponential map from range -1,1 to range between arg 2 and arg 3
- `uexp` : unipolar exponential map from range 0,1 to range between arg 2 and arg 3

- `linlin` : arbitrary linear map from range between arg 2 and 3, to range between arg 4 and arg 5
- `linexp` : arbitrary exponential map from range between arg 2 and 3, to range between arg 4 and arg 5


# Lists

Some functions have lists as arguments, or return lists.  Lists are enclosed in square brackets, and contain signals, separated by commas, e.g.

```
[1,2,3]

[1, {100}saw]

[{}mouseX, {}mouseY]

```

Individual list elements can be accessed with the ```at``` function, with two arguments: a list and an index.

```
{[1,2,3],1}at;
```


# Communication to the JS Window

### Send data:

10 times per second (argument 1) on channel 0 (argument 2). The third argument is signal to send (in this case the output of `{1}sin`).

In the live code editor:

`{{10}imp,0, {1}sin}toJS`

In the model/js editor:

```
input = (x,channel) => {console.log([x,id])};

```

### Receive data from model:

In the live code editor:

`{{0}fromJS}saw`

to receive data on channel 0

In the model/js editor:

```
output(100,0)
```

Note: to separate the two functions in the model window you use three or more underscores:

```
__________
```
# Mouse Input

Use `{}mouseX` and `{}mouseY`

e.g. this is an FM synthesis with mouse control
```
:freq:{{}mouseX,100,1000}uexp;
:freq2:{{}mouseY,1000}mul;
:mod:{{:freq2:}sin,100}mul;
>{{:freq:,:mod:}add}sin;
```



# Machine Listening

### fft

FFT - fast fourier transform

Arguments:
1. A signal
2. The number of bins
3. Hop size, as a percentage of the FFT period

Outputs: an array with three elements
1. A trigger signal, which triggers every time the FFT updates
2. An array of frequency strengths (same size as the number of bins)
3. An array of phases (same size as the number of bins)

```
//fft analysis of the microphone
:fftdata:{{1}adc, 512, 0.25}fft;
:trig:{:fftdata:,0}at;
:frequencies:{:fftdata:,1}at;
:phases:{:fftdata:,2}at;

//map bin 5 of the fft to the frequency of a saw wave
>{{{:frequencies:,5}at,1000}mul}saw;
```


# Triggers

### onzx

Positive zero-crossing detection

Arguments:
1. A signal

```
:osc:{1}sqr;
:zerocrossing:{:osc:}onzx;
:env:{:zerocrossing:,10,500,0.1,1000}env;
>{{50}saw,:env:}mul;
```


### onchange

Create a trigger when a change occurs in the input signal

Arguments:
1. A signal
2. Tolerance (a trigger will be generated if the change is more than +/- this value)

### count

Counts up when receiving a trigger

Arguments:
1. Input trigger
2. Reset trigger

### idx

Index into a list

Arguments:
1. Trigger input - output a value when triggered
2. The index of the value to be output when a trigger is received (normalised to between 0 and 1)
3. A list of values



# Conversion

### MIDI to frequency

For now, you can do the conversion directly using math functions.

```
:freq:{{2,{{:midinote:,69}sub,12}div}pow,440}mul;
```

```
:midinote:{{12}clp, [1],[32,33,34,35,36,37,38,39,40,41,42,43]}rsq;
:freq:{{2,{{:midinote:,69}sub,12}div}pow,440}mul;
:osc:{:freq:}saw;
>{:osc:, 200, 1, 0, 0, 1, 0}svf;
```

# Sequencing

### quantise

When you evaluate your code, choose whether to bring it in on a new bar or immeadiately

Arguments:
1. On (1) or off (0)


To play new code immeadiately:
```
{0}quantise;
```

To play new code at the start of the next bar:
```
{1}quantise;
```

By default, this value is set to 0.

### clk

Set the clock

Arguments:
1. bpm
2. number of beats in a bar

```
{140,4}clk;
> {{4}clt}\spade;
```

### clp

Clock phasor, rises from 0 to 1 each period

Arguments:
1. Rise time, in multiples of the bar length
2. Phase offset (0 - 1)

### clt

Clock trigger. This generates a trigger every period.

Arguments:
1. Time between triggers, in multiples of bar length
2. Phase offset (0 - 1)

```
{150,4}clk;
:channel1: {{4}clt}\spade;
:channel2: {{1}clt}\909b;
:freq:{{3}clp, 20, 200}uexp;
:channel3: {{:freq:}saw, 0.1}mul;
> {:channel1:, :channel2:, :channel3:}mix;
```

### rsq

Ratio sequencer

Arguments:
1. A phasor
2. An array of time ratios.  The phasor period is divided into these ratios, and a trigger is emitted at the beginning or each division
3. (optional) An array of values. At the start of each time division, a value is read from the list. Successive values are read, in a loop.

```
:control:{1}clp;
:seq:{:control:, [3,3,2,1]}rsq;
>{:seq:,0.5, 0.9}\click;
```
```
:control:{2}clp;
:mod:{:control:, [2,4,2], [0,0.5,0.75]}rsq;
>{{80}saw, 800, 1, 0.03, :mod:}flange;
```


# Data

### const

Assign a value directy to a variable

```
:beats:{17}const;
```

# Debugging

### poll

Send a value to the javascript console, once per second

```
{{0.1}pha}poll;
```
