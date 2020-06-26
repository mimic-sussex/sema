# The Ratio Sequencer

The ratio sequencer is a very flexible function for creating sequences or triggers or numbers.

## Basic Usage

### Sequences of triggers

As we've covered already, you can make sequences using samples and triggers. For example:

```
:trigger:{2}clt;
>{:trigger:,1}\boom2;
```

In the above code, we get a trigger from ```clt```. To make a more complex rhythm we can use ```rsq```. For triggering, it takes two inputs:

1. A phasor.  This is a signal that rises repeatedly from 0 to 1. We can use ```pha```, or ```clp``` if you want a phasor that's synchronised to the main clock.
2. An array of ratios into which the period of the phasor will be divided.
