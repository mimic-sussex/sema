# The Ratio Sequencer

The ratio sequencer is a very flexible function for creating sequences or triggers or numbers.

## Basic Usage

### Sequences of triggers

As we've covered already, you can make sequences using samples and triggers. For example:

```
:trigger:{2}clt;
>{:trigger:,1}\boom2;
```

In the above code, we get a trigger from ```clt```.

To make a more complex rhythm we can use ```rsq```. For creating sequences of triggers, it takes two inputs:

1. A phasor.  This is a signal that rises repeatedly from 0 to 1. We can use ```pha```, or ```clp``` if you want a phasor that's synchronised to the main clock.
2. An array of ratios into which the period of the phasor will be divided.  At the start of each period, a trigger will be produced.

Let's explore some examples.
```
:phasor:{1}clp;
:trigger:{:phasor:, [1,1]}rsq;
>{:trigger:,1}\boom2;
```
This code above is equivelant to the first block of code. It takes a phasor `{}clp` that runs once per bar, and divides it into two halves (the ```[1,1]``` part), resulting in to triggers per bar.

We could divide the bar into three beats instead, by changing the array to ```[1,1,1]```:

```
:phasor:{1}clp;
:trigger:{:phasor:, [1,1,1]}rsq;
>{:trigger:,1}\boom2;
```

Now let's try some more complex rhythms. This example makes two short beats then a double length beat:

```
:phasor:{1}clp;
:trigger:{:phasor:, [1,1,2]}rsq;
>{:trigger:,1}\boom2;
```

This example plays three beats and then a triplet:

```
:phasor:{1}clp;
:trigger:{:phasor:, [9,9,9,3,3,3]}rsq;
>{:trigger:,1}\boom2;
```

Try to get a feel for how the sequencer works by trying out your own rhythms.

To change the speed of the sequence, change the speed of the phasor that controls it.  For example:

```
:phasor:{2}clp;
:trigger:{:phasor:, [3,3,1,1,1]}rsq;
>{:trigger:,4}\boom2;
```

or
```
:phasor:{0.3}clp;
:trigger:{:phasor:, [3,3,1,1,1]}rsq;
>{:trigger:,0.1}\boom2;
```


### Sequencing values

There's a third optional parameter for ```rsq```: an array of values.  When a trigger is generated, a value is taken from this list. Values are taken from successive positions, and when the end of the list is reached, we go back to the start.

Here are some examples of how this works. In each example, try changing the values in the arrays controlling the sequencer and see what effect this has.

An arpeggiator:

```
:frequency:{{4}clp, [1,2], [50,100,200,400]}rsq;
>{:frequency:}saw;
```

Sequencing a filter:

```
:frequency:{{5}clp, [1,2], [50,100,200,400]}rsq;
>{{100}sqr, :frequency:, 10}lpz;
```

Sequencing the resonance and frequency of a filter:

```
:frequency:{{5}clp, [1,2], [50,100,200,400]}rsq;
:res:{{10}clp, [2,2], [0,10,30,60]}rsq;
>{{100}sqr, :frequency:, :res:}lpz;
```

Controlling distortion of a sample:
```
:hihat:{{8}imp}\909closed;
:dist:{{8}imp,[1], [0.1,0.5,1,-1]}rsq;
>{:hihat:,:dist:,0.5}asymclip;
```


### Sequencing the sequencer

The values controlling ```rsq``` don't need to be fixed.  You could use another function:

```

:trig:{{3}clp, [1,2]}rsq;
:speed:{{3}clp, [1,2], [1,2, {0.1}pha]}rsq;
>{:trig:,:speed:}\909closed;
```

or another ```rsq```:

```
:trig:{{3}clp, [1,2]}rsq;
:varyingspeed:{{1}clp, [1], [0.5,4,2,3]}rsq;
:speed:{{3}clp, [1,2], [1,2, :varyingspeed:]}rsq;
>{:trig:,:speed:}\909closed;
```


There are so many possibilities here:  go ahead a try your own.  The mapping functions in the next tutorial will open up more creative options.
