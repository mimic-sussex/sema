# Data Streams: Sharing Data between the Machine Learning and Live Coding Windows

There are two pairs of functions that send data between the audio engine (controlled by the live coding window) and the machine learning thread (controlled by the machine learning window).

```toJS``` in the audio engine sends data to a handler called ```input``` in the machine learning thread.

```output``` in the machine learning thread sends data to ```fromJS``` in the audio engine.

The two systems, audio and machine learning, run in different threads on your computer, and messaging between them is asynchronous.  This means that (a) the sending functions do not wait for the receiver to receive the message and (b) a message is not guaranteed to arrive as soon as it's sent, especially if it's in competition with other messages. However, it's very likely that it will be extremely fast.  

From now on LC will refer to the livecoding editor and ML means the machine learning editor.

## Sharing single values

Let's try and example of sending data from ML to LC.

```
//copy this to LC
>{{0}fromJS}saw;
```

```
//copy this to ML
output(50,0)
```

In LC, ```fromJS``` listens on channel 0 (the first parameter), for a number which becomes the frequency of the saw wave.

In ML, ```output``` sends the value 50 on channel 0

Try changing the value ```50``` to something else and see what you here.  You could also try changing the code in the LC window to control something different with ```fromJS```.


You could also send triggers. In this example, a mini-sequencer in ML sends triggers to a kick drum

```
//copy to LC
>{{{0}fromJS}\909b, 0.5,1}asymclip;
```

```
//copy to ML
var a = [0,1,0,0,0,1,0,0,1];
var idx=0;
var send = () => {
	output(a[idx++ % a.length],0);
	setTimeout(send, 100);
}
_____

send()
```

To stop the sequencer, you need to comment out the ```setTimeout``` line and the re-evaluate function.   

It's probably much easier to control frequencies and triggers from within the LC window, but what we're eventually aiming for is to have machine learning models sending out triggers, frequencies or any other data to control the audio engine.

In the opposite direction, we can send data from LC to ML:


```
//copy to LC
{2,{0.1}pha, 1}toJS;
```

```
//copy to ML
input = (x, id) => {console.log(`value: ${x}, channel: ${id}`)};
```

Here, twice a second (parameter 1) ```toJS``` sends a 0.1Hz phasor (parameter 2) on channel 1 (parameter 3).

The data is received by the ```input``` function, which is called every time a message is received from LC.  The function has two parameters, a channel identifier, and a value. The value of the phasor is shown in the javascript console.



We could respond directly from the input handler with a new message, thereby using the ML window to process data and send it background

```
//copy to LC
{7,{1}pha, 3}toJS;
> {{0}fromJS}tri;
```

```
//copy to ML
input = (x, id) => {output((100*x) + 40, 0);};
```

Here, a phasor is sent to ML, which maps it to a frequency value and sends it back to LC, for it to be mapped to a triangle oscillator.


## Sharing arrays

We can also use these functions to pass around arrays. This is really useful for manipulating FFT data.
