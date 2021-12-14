# Creating Buffers in the JS Window

In this tutorial, you will need to open the JavaScript console.  You can do this in Chrome by opening the 'Developer Tools' (F12 key) and choosing the console tab.

Copy the code below into the LC and JS windows.  The LC code plays a buffer.  If it hasn't created yet, the code will still compile but you won't hear anything.  Run the code in the JS window to fill the buffer with a sound, and then re-run the code in the LC window.

LC:

```
>{{4}clt}\newbuf;
```

JS:
```
//create a blank array
a = new Float32Array(1000);

_____

//generate a sound and fill the array with it
for(let i=0; i < a.length; i++) {
		//sine + noise
    a[i] = Math.sin(i/2) + (Math.random() -0.5);
		//percussive envelope
    a[i] *= 1.0-(i/a.length);
}
______
//take a look at the values in the console
a
_____

//send it to the audio engine
sema.sendBuffer("newbuf",a)

//now re-reun the code in the LC window
```

You can experiment with different ways of creating buffers; try varying the parameters in the code above, or make something new.  

This mechanism let's you take raw audio output from a machine learning model, and use it as material for live coding performance.
