# Default Language: Inputs and Outputs

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
