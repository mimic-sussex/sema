# A Sequencer Powered By Machine Learning

This tutorial is about starting to get a feel for how machine learning works - this is machine learning from the musician's perspective.  Make sure the audio engine is started, and run the code in the JS window - then the rest of the tutorial is livecoding.  You will learn the processes around training and running machine learning models.

You may have seen another language in Sema called Rubber Duckling.  It's a language based on an old acid-sequencer from the 90s, Rubber Duck, and it does fairly straight-forward drum and 303-style sequencing. It's simple and easy to learn.  For this tutorial, we're using an upgraded version of this language with some machine learning to enable an 'agent' to learn how to play one of the sequences.  This language is called Rubber Gosling.


## Part 1: Learning 'Rubber Gosling'

There are four sampled instruments, kick, snare, closedhat and openhat.  If you type their name, they start playing.

```
bpm 120;
kick;
snare;
```

To increase the speed of a sequence, use `*`.

```
bpm 150;
kick*4;
snare*2;
```

To offset a sequence, use `+`.
```
bpm 150;
kick*4;
snare*2+0.5;
```

To create a pattern, add the timing ratios that describe the pattern.

```
bpm 150;
kick*1 3,3,2;
snare*1 2,2;
```

This is the same way in which we use the ratio sequencer in the default language (```rsq```).

Add effects in brackets after the ratios.
```
bpm 150;
kick*2 3,3,2 (dist:2, lpf:200);
snare*1 2,2 (amp:0.9,hpf:300);
openhat*2 1,1,1 (amp:2.1, hpf:3000);
```

There are four effects. Each one has one number to control it.

1. ```dist```: distortion. Parameter: distortion level, 1 and above
2. ```amp```: amplitude. Parameter: amplitude level (1==100%, 0.5=50% etc)
3. ```lpf```: low pass filter. Parameter: frequency (20-20000)
3. ```hpf```: high pass filter. Parameter: frequency (20-20000)

To add a synth, use ```lead``` or ```bass```.  They are sequenced like the samples above, but with the addition of a list of notes numbers. These are 'MIDI' not numbers. C4 is note 60, 61=C#, 62=D etc

```
bpm 150;
kick*2;
lead*4 2,1 20,32,60;
```

There are some extra controls for the synths: ```cut```, ```res```, and ```env```, all between 0 and 100. You can add effects too.

```
bpm 150;
kick*2;
lead*4 2,1 20,32,60 cut100 res90 env70 (dist:2,hpf:300);
```

To use the mouse to control a synth param, use ```_mousex``` or ```_mousey```.

```
bpm 150;
kick*2;
bass*4 2,2 22,32 cut30 res90 env1 (dist:2,lpf:100);
lead*4 2,1 32,48,60 cut_mousex res_mousey env70 (dist:10,hpf:800);
```

## Part 2: Live Machine Learning

In the background, there's a machine learning process running in the JS window. There's a machine learning 'model' that you can train to play one of the drum parts, based on what it hears from another drum part.  For example, we can teach the model to automatically play the snare drum, by showing it examples of of the kick drum and snare drum together.  You might think of this model as a percussionist who wants to know what to play but doesn't have a score.  You show them examples of what to play, and then they take over.  They might play the parts correctly or incorrectly, depending on what you show them.

To explore this process, we have three commands to add to the language: ```source```, ```learn``` and ```predict```. These commands go before the name of an instrument.

```source``` designates the instrument that the machine learning model is listening to.

```learn``` specifies that an instrument's sequence is being sent to the machine learning model as an example of what to learn

```predict``` listens to the predictions from the machine learning model, and plays them *instead* of the sequence you specify in the language.

During the learning process, it may be helpful to look at the JavaScript console (open it with F12). You will be able to see the *loss* from training the model.  This indicates the level of error that is occurring in the training process.  A smaller number is better, although if number that is very small will mean that your model might be trained 'too' well (i.e. it won't be very flexible in how it plays).

Let's start with this code:

```
bpm 150;
source kick*2;
snare*2;
closedhat*1 1;
```

We have a simple sequence, and we're sending the kick drum to the machine learning model.

Type ```predict``` before 'snare'.

```
bpm 150;
source kick*2;
predict snare*2;
closedhat*1 1;
```

You will now hear the predictions of the untrained model. This could be anything (it might be no sound at all) - the model starts off as a random process, we need to teach it what to do.


Now let's try to learn the snare pattern - type ```learn``` before 'snare' and evaluate the code. You will see the *loss* in the JS console. Wait until it's low - around 0.02, and then switch back to prediction by typing ```predict``` instead of ```learn```.

```
bpm 150;
source kick*2;
learn snare*2;
closedhat*1 1;
```

The model should now have associated this kick drum pattern with the snare drum pattern that you showed it, and hopefully is now playing the same pattern.

But what happens when it hears a different kick pattern? Try increasing the tempo of the kick.

```
bpm 150;
source kick*4;
predict snare*2;
closedhat*1 1;
```

The model hasn't yet learnt what to do when it hears this kick pattern, so the response will be the model's best guess, based on it's previous training and the random point from which it was initialised.

Let's teach it another snare pattern to associate with this kick pattern. First of all, you can try out some patterns without starting the learning process, e.g.

```
bpm 150;
source kick*4;
snare*2 2,4,2;
closedhat*1 1;
```

Then switch to learning mode:

```
bpm 150;
source kick*4;
learn snare 2,4,2;
closedhat*1 1;
```

You will see the *loss* rise, and then start to fall again.  At anytime, you can change ```learn``` to ```predict``` to see how well the model has learnt the pattern.

When you have finished training, switch back to the original kick pattern:

```
bpm 150;
source kick*2;
predict snare 2,4,2;
closedhat*1 1;
```

Does the model still do what you originally trained it to do?

You can continue in this manner, teaching the model what to play based on different drum patterns.  Think about the following questions:

1. How often does the model train perfectly?
2. How does teaching it new material affect the material it has previously learnt?
3. Does it create any surprising results?  Did they sound good?
4. What happens when you train to (a) higher losses? and (b) very low losses?
5. What happens if you switch the source of a trained model?
6. How does the model respond to learning more complex sequences?
7. Does the model train more easily with any particular style of rhythm?
7. How does the model respond to patterns it hasn't heard before?

A note on using this system: data is sent to the model using a clock that triggers 8 times per bar.  Any sequences that are faster or more complex than this timing will get quantised into these 8 clock periods.

If at any time you want to start with a fresh model, just re-run the code in the JS window.


#### Advanced Use

This assumes some knowledge about neural network architecture.  The size of the layers is specified in the ```structure``` variable at the start of the JS script.  You can change this list to experiment with different architectures - just change the array and re-run the script.
