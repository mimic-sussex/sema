# Sampling

## Triggering samples

Here's an example of a sample player in the default language

```
>{{1}imp}\909b;
```

```\909b``` is the name of a sample, taken from the list of preloaded samples here: [samples](/docs/sample-loading).  You can also generate samples from the machine learning window (see the tutorials in the next section).

Preceeding the sample name is a single parameter, a signal. When this signal cross from below to above zero, the sample is triggered. In this case we're using an impulse generator, which generates an impulse once a second to trigger the sample.  You can listen to this on its own by moving the ```>``` operator.

Any signal with positive zero-crossings will trigger a sample, here are some examples using...

a saw wave

```
>{{2}saw}\909closed;
```

a pulse wave
```
>{{4,0.2}pul}\909;
```


a pattern with one oscillator modulating the speed of another

```
:trig:{{{0.3}sin,2,16}blin}sqr;
>{:trig:}\909;
```

or with another sample

```
:trig:{{1}imp,0.1}\909b;
>{:trig:,1}\909closed;
```

Note that the first sample player above has an additional parameter. Let's see what this does...

### Manipulating sample playback

A sample player can take two further arguments: speed and offset.

The speed parameter is a multiplier of the samples original speed. In the code below, the sample plays at half speed.

```
>{{0.3}imp, 0.5}\boom;
```

and the sample below plays at triple speed

```
>{{0.5}imp, 3}\machine;
```



The third parameter, the offset, is the point from which the sample is played (0 = the start, 0.5 = from half way, etc)

In this example, the attack is removed from the kick drum because it starts 10% of the length ahead of the beginning.

```
>{{0.5}imp, 1, 0.1}\909b;
```


Take a look at the sequencing tutorial for more examples of how to use samples.


### Looping and slicing samples

Samples can be looped and sliced using the slicer functions.  To use this, replace the ```\``` at the beginning of the sample name with a bar symbol ```|```.  The slicer continually loops a sample.  It takes two parameters: the first is a trigger, which retriggers the sample. The second is the position within the sample that the slicer starts from when it receives a trigger.

This code simply loops a samples
```
>{0,0}|patterndrone2;
```

We can add a trigger to the first parameter. Try varying the frequency of the impulse and the offset parameters (between 0 and 1)

```
>{{1}imp,0.3}|patterndrone2;
```

The second parameter could be controlled by an oscillator. Here, a phasor slowly moves the offset point in a 10 second cycle

```
>{{3}imp,{0.1}pha}|patterndrone2;
```

The example below does a very rough timestretch (although it clicks a bit)

```
>{{16}imp,{0.1}pha}|convol5;
```

And this one compresses the sample length
```
>{{16}imp,{2}pha}|convol5;
```

This uses noise to randomly select each offet point

```
>{{8}imp,{{1}noiz,0,1}blin}|convol5;
```
