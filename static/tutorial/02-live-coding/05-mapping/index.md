# Mapping

A very common task in computer music is to map numbers from one domain to another. For example, using an oscillator to control a frequency.  Good mapping enables you to be very expressive; it enables you to connect things together creatively.  

When we think about mapping, we need to consider two basic things:  the range of numbers, and the curve of the mapping.  

These are the mapping functions available in Sema:

```blin``` maps linearly from a bipolar range (between -1 and 1). This is useful for mapping from oscillator sources:

```
:lfo:{{1}sin, 1,50}blin;
:osc:{50,0.2}pul;
>{:osc:, 500, :lfo:, 0, 1, 0,0}svf;
```

```bexp``` maps from bipolar to exponential ranges, which is best for frequency mappings

```
:lfo:{{1}sin, 50,5000}bexp;
:osc:{50,0.2}pul;
>{:osc:, :lfo:, 3, 0, 1, 0,0}svf;
```


```ulin``` maps linearly from a unipolar range (between 0 and 1). This is useful for mapping from phasors:

```
:lfo:{{1}pha, 10,1}ulin;
:osc:{50,0.4}pul;
>{:osc:, 300, :lfo:, 0, 1, 0,0}svf;
```

```uexp``` maps from unipolar to exponential ranges, which is best for frequency mappings

```
:lfo:{{0.1}pha, 50,10000}uexp;
:osc:{50,0.8}pul;
>{:osc:, :lfo:, 10, 0, 0, 1,0}svf;
```


With ```linlin``` and ```linexp``` you can specify the range of the source signal

```
:lfo1:{{0.25}pha, 0, 1, 50,500}linexp;
:lfo2:{{0.35}sin, -1, 1, 1, 10}linlin;
:lfo3:{{0.1}sin, -1, 1, 1, 0}linlin;
:lfo4:{{0.1}sin, -1, 1, 0, 1}linlin;
:osc:{50,0.8}pul;
>{:osc:, :lfo1:, :lfo2:, :lfo3:, 0, :lfo4:,0}svf;
```
