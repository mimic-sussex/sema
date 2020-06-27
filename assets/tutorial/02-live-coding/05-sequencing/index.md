# Basic sequencing and clocks

For sequencing in the default language, there are 3 core function:

```clk``` configures the clock

```clt``` outputs triggers relative to the clock frequency

```clp``` outputs a phasor relative to the clock frequency


```
{140,4}clk;
> {{4}clt}\spade;
```

In the above example, the ```clk``` is used to configure the clock in Sema's audio engine to play at 140bpm, with 4 beats in a bar.  When you evaluate a new piece of code, the audio engine will wait until the start of a new bar to swap it with your old code.

You may remember from the sampling tutorial that the first parameter being sent to a sample player is a trigger signal, i.e. when the signal crosses from below zero to above zero, then the sample will play once.  In this case, we're using ```clt``` to play the sample. This function plays triggers relative to the clock; the parameter is the number of triggers it will play per bar so in the case it creates 4 triggers per bar.

We can make the effects of these parameters more obvious by playing two sounds at once:

```
{150,4}clk;
:channel1: {{3}clt}\spade;
:channel2: {{1}clt}\909b;
> {:channel1:, :channel2:}mix;
```

Try varying the frequencies of the two ```clt``` functions.

```clp``` is also used for sequencing.  It outputs a phasor, i.e. a signal that rises from 0 to 1 and repeats.   The first parameter is a frequency, just like for ```clt```.

This example below lets you listen to the phasor as it controls the frequency a saw wave.

```
{150,4}clk;
:channel1: {{4}clt}\spade;
:channel2: {{1}clt}\909b;
:freq:{{3}clp, 20, 200}uexp;
:channel3: {{:freq:}saw, 0.1}mul;
> {:channel1:, :channel2:, :channel3:}mix;
```

This function will become really useful when we get to more advanced sequencing.


```clt``` and ```clp``` both have a second parameter: a phase offset, between 0 and 1. It delays the start of each trigger or phasor, as a percentage of the cycle length.

For example:

```
{150,4}clk;
:channel1: {{3,0.25}clt}\909open;
:channel2: {{3}clt}\909b;
> {:channel1:, :channel2:}mix;
```

The second parameter of the ```clt``` controlling the hihat is set to 0.25, so that it gets triggered part-way between each kick drum. Try varying this parameter to see the effect.
