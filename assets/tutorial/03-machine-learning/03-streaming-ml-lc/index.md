# Data Streams: Sending data from the JavaScript window to the livecoding window

In this tutorial, you will need to open the JavaScript console.  You can do this in Chrome by opening the 'Developer Tools' (F12 key) and choosing the console tab.


In the default language, you can use ```fromJS``` to receive data from the JS window.  You can also use this in the Sema type system for custom languages.
The first argument is the channel number on which to receive data. A second optional argument controls timing, we'll look at that later.

## Sending single value streams

Let's start with a simple example.

In the LC window:
```
:freq:{0}fromJS;
>{:freq:}saw;
```

This receives data on channel 0 into the ```:freq``` variable, to control the frequency of a saw oscillator.

In the JS window:
```
var channel0 = createOutputChannel(0, 1);

____

channel0.send(200)
```

The function ```createOutputChannel``` takes two arguments:

1. a channel number
2. the block size of the data

In this case we're sending one number at a time, so we choose a block size of 1.

When you run the `channel0.send(200)` it sends the number 200 to the JS window, which becomes the frequency of the saw wave.  Try sending some other numbers.

### Triggered reading of values

The second argument of ```fromJS``` is a trigger to determine when a value is read. It's optional; if you leave it out, the value will update whenever it's received from the JS window.  If you send a trigger signal as the second argument, the value updates on each trigger.  For example:

LC:
```
:freq1:{{4}clt,[1],[50,100,200]}rsq;
:osc1:{:freq1:}sawn;

:freq:{0,{1}clt}fromJS;
:osc2:{:freq:}sawn;

>{:osc1:,:osc2:}mix;
```

JS:
```
var channel0 = createOutputChannel(0, 1);
___

channel0.send(300)
```

When you send a new value, it gets quantised to the start of a bar because it's triggered by ```{1}clt```.



### Sending more than one channel




This example shows three concurrent channels.

LC:
```
:lfofreq:{0}fromJS;
:lfo:{:lfofreq:}sin;

:detune:{1}fromJS;
:freq:{80}const;
:osc1:{:freq:}sqr;
:freq2:{:freq:,:detune:}mul;
:osc2:{:freq2:}sqr;

:res:{2}fromJS;
:osc:{:osc1:,:osc2:}mix;
>{:osc:,{:lfo:,100,4000}bexp,:res:}lpz;
```

JS:
```
var lfo = createOutputChannel(0, 1);
var detune = createOutputChannel(1, 1);
var resonance = createOutputChannel(2, 1);
___

lfo.send(1);
detune.send(1.03);
resonance.send(4);
____

lfo.send(6);
detune.send(1.05);
resonance.send(9);

____

lfo.send(0.1);
detune.send(1.003);
resonance.send(50);

```


You could even set up a sequencer controlled from JavaScript:

(replace the code in JS with the code below)

```
var channel0 = createOutputChannel(0, 1);
____

//edit this while the sequencer is playing
var sequence=[25,50,100,200,400,800,1600];
var noteLength=50;
___
var pos=0;
var playNote = () => {
	channel0.send(sequence[pos++ % sequence.length]);
	//comment out this line and evalulate to stop the sequence
	setTimeout(playNote,noteLength);
}
playNote()
```

It's much easier to create this sequence in the LC window using ```rsq``` but this sort of technique could be useful if you want to send timed sequences from a machine learning model.


## Sending arrays

Data can also be sent in arrays, which is useful for sending mappings from machine learning models.

This is an adaptation of the earlier three channel example, where all the data is sent as a block of three values on a single channel, and accessed using the ```at``` command in the LC window.

LC:
```
:params:{0}fromJS;
:lfofreq:{:params:,0}at;
:lfo:{:lfofreq:}sin;

:detune:{:params:,1}at;
:freq:{80}const;
:osc1:{:freq:}sqr;
:freq2:{:freq:,:detune:}mul;
:osc2:{:freq2:}sqr;

:res:{:params:,2}at;
:osc:{:osc1:,:osc2:}mix;
>{:osc:,{:lfo:,100,4000}bexp,:res:}lpz;
```

JS:
```
var params = createOutputChannel(0, 3);
___

params.send([1, 1.03, 4])
____

params.send([6, 1.05, 9])
____

params.send([0.1, 1.003, 50])

```

Sending arrays is useful for transmitting spectral information, as we'll see in the next example
