
# **Sema Intermediate Representation**

The following are the **types** of our intermediate Sema language

# @lang
This is the top level node of the tree, and contains an array of branches

```
{ "@lang" : [branches]}
  ```
# @sigOut  

Output a signal from the signal engine
```
{"@sigOut": <branch>}
```

# @spawn
Execute a branch of a tree
```
{ "@spawn":<branch>}
```
# @num
```
{"@num":{value:val}}
```
# @str
```
{"@string":val}
```
# @setvar
Set a variable, with the output from a branch of the tree.
```
{"@setvar": {"@varname":<string>,"@varvalue":<branch>}};
```
# @getvar
Get a variable

```
{"@getvar":<string>}
```

# @sigp
@sigp represents a signal processor or signal generation.  It looks like this:

```
{"@sigp": {"@params":[params], "@func":<string>}}
```
It needs a function name, and an array of parameters.   You can use any of the options below:

## Audio inputs

### adc
Get a signal from the system default input
Parameters:
  1. Gain

## Audio outputs

### dac
Output a signal to the system default audio interface

Parameters:
  1. Signal
  2. (optional) Channel number (starting from 0)

If parameter 2 is to given, then the signal is copied to all the outputs


## Oscillators

### saw
A saw oscillator
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### sin
A sinewave oscillator
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### tri
A triangle wave oscillator
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### sqr
A square wave oscillator
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### pha
A phasor, rising from 0 to 1
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### ph2
A phasor with configurable start and end levels
Parameters:
 1. Frequency (Hz)
 2. Start level
 3. End level
 4. Initial Phase (0 - 1)
### pul
A pulse oscillator with modulatable phase width
Parameters:
 1. Frequency (Hz)
 2. Phase width (0-1)
 3. Initial Phase (0 - 1)
### imp
An impulse generator
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### sawn
An band limited saw wave oscillator
Parameters:
 1. Frequency (Hz)
 2. Initial Phase (0 - 1)
### noiz
An white noise generator
Parameters:
 1. Amplitude

## Sampling
### sampler
Creates a sampler with a signal input, the sample plays when the input has a positive zero crossing
 1. Input signal
 2. Sample name
### loop
Creates a sampler that plays in a continuous loop
 1. Speed
 2. Sample name
### slice
Slice up a sample
1. Trigger, on which to set the sample position
2. The sample position to set when a trigger is received (0-1)
3. The sample name
### sah
Sample and hold
1. Input signal
2. Hold time (ms)



## Math Operations
### gt
Outputs 1 if $A > B$, otherwise 0
Parameters:
 1. A
 2. B
### lt
Outputs 1 if $A < B$, otherwise 0
Parameters:
 1. A
 2. B
### mod
A modulo B
Parameters:
 1. A
 2. B
### add
$A + B$
Parameters:
 1. A
 2. B
### sub
$A - B$
Parameters:
 1. A
 2. B
### mul
$A * B$
Parameters:
 1. A
 2. B
### div
$A / B$
Parameters:
 1. A
 2. B
### pow
$A ^ B$
Parameters:
 1. A
 2. B
### abs
The absolute value of A
Parameters:
 1. A
### sum
Sums all parameters $\sum(x_1, x_2 ... x_n)$
### prod
Product of all parameters $\prod(x_1, x_2 ... x_n)$
### mix
Mean of all parameters $\frac{\sum(x_1, x_2 ... x_n)}{n}$

## Modulation
### env
ADSR envelope generator
Parameters:
 1. Trigger
 2. Attack  (ms)
 3. Decay   (ms)
 4. Sustain (0-1)
 5. Release (ms)

## Mapping
### blin
Map input into a linear range, assuming bipolar source (between -1 and 1)
Parameters:
 1. Input signal
 2. Lower bound of destination range
 3. Upper bound of destination range
### bexp
Map input into an exponential range, assuming bipolar source (between -1 and 1)
Parameters:
 1. Input signal
 2. Lower bound of destination range
 3. Upper bound of destination range
### ulin
Map input into a linear range, assuming unipolar source (between 0 and 1)
Parameters:
 1. Input signal
 2. Lower bound of destination range
 3. Upper bound of destination range
### uexp
Map input into an exponential range, assuming unipolar source (between 0 and 1)
Parameters:
 1. Input signal
 2. Lower bound of destination range
 3. Upper bound of destination range
### linlin
Map input into a linear range, specifying the range of the source
Parameters:
 1. Input signal
 2. Lower bound of source range
 3. Upper bound of source range
 4. Lower bound of destination range
 5. Upper bound of destination range
### linexp
Map input into an exponential range, specifying the range of the source
Parameters:
 1. Input signal
 2. Lower bound of source range
 3. Upper bound of source range
 4. Lower bound of destination range
 5. Upper bound of destination range

## Effects
### dist
Tanh distortion
 1. Input signal
 2. Distortion level (0 upwards)
### dl
Delay
 1. Input signal
 2. Delay time (in samples)
 3. Feedback
### flange
Flanger
 1. Input signal
 2. Delay (ms)
 3. Feedback (0-1)
 4. Speed (Hz)
 5. Depth (0-1)
### chorus
Flanger
 1. Input signal
 2. Delay (ms)
 3. Feedback (0-1)
 4. Speed (Hz)
 5. Depth (0-1)

## Filters
### lpf
One pole lowpass filter
 1. Input signal
 2. Filter amount (0-1)
### hpf
One pole highpass filter
 1. Input signal
 2. Filter amount (0-1)
### lpz
Resonant lowpass filter
 1. Input signal
 2. Filter frequency (Hz)
 3. Resonance
### hpz
Resonant lowpass filter
 1. Input signal
 2. Filter frequency (Hz)
 3. Resonance
### svf
State variable filter
1. Input signal
2. Cutoff frequency (Hz)
3. Resonance
4. Low pass filter amount (0-1)
4. Band pass filter amount (0-1)
4. High pass filter amount (0-1)
5. Notch filter amount (0-1)

## Networking

### oscin
Receive and open sound control signal
 1. OSC address
 2. Index of the OSC data element to observe (-1 means all elements)

### toPeer
 1. Signal
 2. Destination (peer ID) (see sema.peerinfo())
 3. Channel number
 4. Frequency

### fromPeer
 1. Source (peer ID) (see sema.peerinfo())
 2. Channel number

## Machine Learning
### toJS
Creates a transducer for sending a signal to a javascript model
 1. Polling frequency
 2. Data value (this can be a list or a number)
 3. Channel
### fromJS
Creates a transducer for receiving a signal from a javascript model
  1. Channel (a number)

These functions are paired with 'input' and 'output' in the machine learning window

## Clock functions

### clp
Phasor derived from constantly running clock phasor
  1. Multiples of the clock base frequency
  2. Phase offset (0-1)

### clt
Trigger derived from constantly running clock phasor
  1. Multiples of the clock base frequency
  2. Phase offset (0-1)

### clfreq
Set the clock frequency (Hz)
 1. Frequency

### clbpm
Set the clock speed in bpm
 1. Beats per minute

### barfreq
Set the number of times a bar occurs within a cycle of the clock.  New blocks of code are started at the beginning of a bar.
1. Frequency

## Triggers

### onzx
Create a trigger on a zero crossing
 1. A signal

### onchange
Create a trigger when a change occurs in the input signal
1. A signal
2. Tolerance (a trigger will be generated if the change is more than +/- this value)

### count
Counts up when receiving a trigger
1. Input trigger
2. Reset trigger

### idx
Index into a list
1. Trigger input - output a value when triggered
2. The index of the value to be output when a trigger is received (normalised to between 0 and 1)
3. A list of values
