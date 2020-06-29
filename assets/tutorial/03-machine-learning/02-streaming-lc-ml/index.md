# Data Streams: Sending data from the livecoding window to the JavaScript window

In this tutorial, you will need to open the JavaScript console to look at logging data.  You can do this in Chrome by opening the 'Developer Tools' (F12 key) and choosing the console tab.

In Sema, the code from the live coding window is run in the audio engine, and the code that you run in the JavaScript window is run in a separate JavaScript thread.  These two systems do not by default share data together (they probably run on separate CPUs). However, it is possible to share data between them by setting up data streaming channels.  This tutorial shows you how to send data from the audio engine to the machine learning system.

## Streaming single values

To send data from code in the livecode window (let's call this LC) to code in the machine learining window (let's call this JS), we use the command ```toJS``` in the default language.  This is also available in other custom languages using Sema's type system.

```toJS``` has three required parameters:

1. A trigger, on which to send data
2. A channel number
3. A signal

For example, copy this into the LC window:

```
{{25}imp, 0, {1}saw}toJS;
```

and copy this into the JS window:

```
input = (id,x) => {
	console.log(id, x);
};
```

After running both pieces of code, you should see the values of the saw wave (cycling from -1 to 1) in the console.  This signal is being sent 25 times a second, triggered by the ```{25}imp```.  Try changing this number; it will change the speed at which data is sent.

If you change the channel number, this will send data on a different channel, reflected in the first number output in the console.

You could try sending a different signal, for example the mouse:

```
{{5}imp, 8, {}mouseX}toJS;
```

sends the mouse x position at 5Hz on channel 8.

## Streaming multiple values on a single channel

We can add an optional 4th parameter to ```toJS``` which is the size of the data in each block that is streamed to the JS window. By default, this is set to 1, for single value streams.

In this example, we set the block size to 2, and send an array of mouse coordinates:

```
{{10}imp, 8, [{}mouseX, {}mouseY], 2}toJS;
```

You could also send data from machine listening, for example MFCC analysis (which indicates the texture of a sound):

```
:n:{1}noiz;
:p:{{1}fromJS}imp;
:x:>{:p:,:n:}|click;
:m:{:x:, 1024,512,5}mfcc;
:trig:{:m:,0}at;
:mfccs:{:m:,1}at;
{:trig:, 0, :mfccs:,5}toJS;
```

or spectral analysis from an FFT:

```
:n:{1}noiz;
:p:{3}imp;
>:x:{:p:,:n:}|click;
:m:{:x:, 64, 0.25}fft;
:trig:{:m:,0}at;
:freqs:{:m:,1}at;
:phases:{:m:,2}at;
{:trig:, 0, :freqs:, 64}toJS;
```
