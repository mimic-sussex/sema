# Parameter Space Exploration

This is part 2 of the FM synthesis tutorial. We will learn about a technique called 'regression', which means to learn a relationship, or mapping, between sets of data. This tutorial goes deeper into how regression works, and shows how you can customise it to use it with your own sounds.  We'll start from scratch to build up customised mappings. You can take the techniques in this tutorial and build your own systems.

## Parameter Spaces

We can think of regression as a method for creating models for exploring a parameters space intuitively.  Sounds generators often have very wide parameter spaces, with multiple controls or mappings. For example, the FM patch in the previous tutorial had 7 parameters, but we could easily multiply this several times by adding a few more operators and some effects.  Each time we add another control, the space of possibilities expands exponentially. These multiple parameters are great for creating complex and varied sounds, but they can also be hard to explore *musicially*; it's difficult to vary several or 10s of parameters at once, to follow trajectories through the space of possibilities that sound synthesis offers.  This is where machine learning comes in. We can use neural networks to learn mappings that allow as to navigate through a parameter space, using low dimensional input that's expressive; we can use a small number of controls to manipulate a larger number of controls.  This also implies some limitations; the neural network will only explore a smaller area of the total parameter space based on this smaller number of inputs.  The space that it will explore is determined by how we train the network.  If we train it well, we can make a space that sounds good to explore, almost like it's a new instrument.  You might say that training the network is part of the process of composing or building an instrument, which we then play after training.  We might also continue to adjust the instrument while we're playing it.  The techniques for this interactive process of playing-training-playing are what we'll learn here. We'll think about regression with livecoding in a generic way that you can apply to your own creative work.

## The JS script

In the JS window, you'll find a version of the script from the previous tutorial, set up to it can be adjusted to different numbers of inputs and outputs. It has some other configuration parameters:

1. structure.  This is an array of the sizes of the layers in the neural work that will be trained by this script.  The default value should be fine for simple configurations, but if you want have more complex mapping problems with more inputs and outputs, try either a higher number, or adding more layers e.g. [50,25] would create a model with two hidden layers of 50 and 25 neurons.
2. useCPU.  Set this to choose to run the model on either your CPU or GPU (graphics processor). GPUs are good for larger models, they process data extremely quickly. However, for realtime music, they can create issues because it can be very slow to get data back from the GPU to the audio engine. CPU is generally a better choice for realtime music if your model is simple enough.


## A basic example

We'll begin with a simple mapping task: we have a script with two parameters, that we wish to explore using the mouse X coordinate.

```
//send data to the JS window
{{20}imp, 0, [{}mouseX], 1}toJS;

//get data back from the JS window and initial mapping
:freq:{50}const;
:detune1:{{0}fromJS, 0.9, 1,1}ulin;
:detune2:{{1}fromJS, 0.9, 1.1}ulin;

//mapping
:freq2:{:freq:,:detune1:}mul;
:freq3:{:freq:,:detune2:}mul;

//generate sound
>{{:freq:}saw, {:freq2:}saw, {:freq3:}saw}mix;
```

Run this code, and follow the instructions in the JS script to learn a mapping.


### Tasks:

1. see if you can add one more parameter to this patch: another detuned oscillator.  You will need to add another channel from the JS window using ```fromJS``` and map the data to an oscillator. Then change the number of outputs in the JS script and re-run it.
2. add in the another control input - the mouse Y coordinate.  You'll need to send this to the JS window, and change the script to accept an extra input


## Variations

What else might we do with this type of mapping? The possibilities are endless, here are some small suggestions:

### Exploring sequencers

In Sema, everything is a signal.  That means you can control a sequencer from a neural network, just like you might control sound synthesis.

Try this code below:

```
//send data to the JS window
{{20}imp, 0, [{}mouseX, {}mouseY], 2}toJS;

:p1:{{0}fromJS,1,2}ulin;
:p2:{{1}fromJS,1,2}ulin;
:p3:{{2}fromJS,1,4}ulin;
:p4:{{3}fromJS,1,3}ulin;
:p5:{{4}fromJS,1,4}ulin;

:seq1:{{1}clp, [:p1:,:p2:,:p5:]}rsq;
:seq2:{{3}clp, [:p4:,:p5:]}rsq;
:seq3:{{2}clp, [:p4:,:p3:,:p2:]}rsq;

:mix:{{:seq1:,:p1:}\auclick, {:seq2:,0.4}\auboom, {{:seq3:,0.44,0.6}\909closed,1.4}mul}mix;

:verb:{:mix:,1,0.9}freeverb;

>{:mix:,{:verb:,0.01}mul}add;

```

You'll need to configure the JS script for 2 inputs and 5 outputs. It uses the parameters to control the ratios in the ```rsq``` sequencers.  Varying the parameter space will create varied rhythms.  Try training model so you can explore the rhythms with a mouse.


### Other inputs

How about using sound as an input?  Let's go back to the original example of detuned saw waves, but controlled by the frequencies in the microphone.

```
//send data to the JS window
//get the mic signal
:mic:{1}adc;
//frequency analysis
:fftdata:{:mic:, 128, 1}fft;
:trig:{:fftdata:,0}at;
:f:{:fftdata:,1}at;

//choose 5 frequencies and send them to the model
{:trig:, 0, [{:f:,2}at, {:f:,8}at, {:f:,15}at, {:f:,25}at, {:f:,40}at], 5}toJS;


//get data back from the JS window and initial mapping
:detune1:{{0}fromJS, 0.5, 2}ulin;
:detune2:{{1}fromJS, 0.5, 2}ulin;
:freq:{{2}fromJS, 50,150}uexp;

//mapping
:freq2:{:freq:,:detune1:}mul;
:freq3:{:freq:,:detune2:}mul;

//generate sound
>{{:freq:}tri, {:freq2:}sqr, {:freq3:}sqr}mix;
```

This code will enable you to map live sound to sound settings in the audio engine. It will work best if you use headphones, otherwise sound from the speakers will interfere with the microphone input.  You'll need to set up the JS script for 5 inputs and 3 outputs.  When you record data, try to make a long constant sound for each mapping, for example whistling a single note or humming.

Things you could try with this script:
1. Changing the sound synthesis method - add oscillators, filters, effects
2. choose different frequencies to send to the model e.g. focus on the bass or mid ranges


### Alternative controllers

When you have trained a model, you don't have to stick to the original input to control it. For example, you could swap mouse coordinates for oscillators or the microphone input - you can use any signal. It will work best if you use a signal with a similar range to the ones you trained the network with. You can use mapping functions to help with this.
