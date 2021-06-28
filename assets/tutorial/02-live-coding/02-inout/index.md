# Inputs and Outputs

## Outputs

Sema will attempt to open all the available channels on your audio interface. If you're using multiple channels, this may not always work as expected due to WebAudio issues.

In the default language, the easiest way to direct sound to your outputs is to use the ```>``` operator.  If you place this operator to the left of a function, then you will hear that function, in all the outputs of your audio interface. For example, try this code:

```
>{{300}sin, {1000}sin}mul;
```

It ring modulates two sine waves.  With the ```>``` operator at the beginning, you listen to the result of the ```mul``` function.  If you move the ```>``` operator to the left of the ```sin``` functions, then you will hear them individually instead


```
{>{300}sin, {1000}sin}mul;
```

```
{{300}sin, >{1000}sin}mul;
```

If you remove the ```>``` operator, you will hear nothing

```
{{300}sin, {1000}sin}mul;
```

### Individual channel outputs

Put a channel number next to the ```>``` symbol to output to an individual channels

For example:
```
>0{{300}sin, {1000}sin}mul;
```

sends the sound to your left channel (in a stereo setup)


```
{>0{300}sin, >1{1000}sin}mul;
```

sends one ```sin``` to the left, and the other to the right.


This also works with multiple lines of code. Try moving the ```>``` around in these two lines of code:

```
>{{1}noiz,200,1}lpz;
{{1}noiz,2000,1}hpz;
```

### Controlling outputs with ```dac```

```>``` is syntactic sugar. If you need more control, you can use ```dac```. This takes two arguments: a signal and an optional channel number

This sends the sound to channel 1
```
{{{1}noiz,200,1}lpz,1}dac;

```

Ommitting the channel number copies the signal to all outputs
```
{{{1}noiz,200,1}lpz}dac;

```

Here, the channel is controlled with a square wave, alternating the signal between channels 0 and 1.

```
{{{1}noiz,200,1}lpz, {1}sqr}dac;
```

## Inputs

Use ```adc``` to a get signal from the default input on your computer (usually your microphone).

This code ring modulates the microphone.  Careful of feedback when you run this.
```
>{{1}adc, {50}sin}mul;
```

The parameter for ```adc``` is the gain of the input.
