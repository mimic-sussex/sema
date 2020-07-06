# Loading Sound Files in Sema

You can load sound files in Sema through the JS window.  Sound files can either be sent to the signal engine as buffers, or used within the JS window (for example to train a machine learning model).

## Make the files available over a web connection (local or remote)

Sound files will be loaded over a http connection, so they need to be hosted on a web server. You can either put them on a public webserver, or run a local webserver on your machine like this:

1. Open a terminal and navigate to the folder where your sound files are
2. Install live-server: https://www.npmjs.com/package/live-server
3. run: ```live-server --cors```.  The ```---cors``` bit makes sure that you don't get any security problems when accessing the files.

When you run ```live-server``` it will open the url of the server in your browser. It will look something like ```http://127.0.0.1:35643/```

##

Let's say you want to load a file called 'spoon.wav'. In the JS window:

```
/// import the aurora library.  There are further versions of this library that decode mp3, flac etc
importScripts("https://cdnjs.cloudflare.com/ajax/libs/aurora.js/0.4.2/aurora.min.js")
___
//if running locally, replace the port number with the one from your webserver - otherwise use the url from the remote server
var asset = AV.Asset.fromURL('http://127.0.0.1:35643/spoon.wav');

var mysample;
asset.decodeToBuffer(function(buffer) {
  // buffer is now a Float32Array containing the entire decoded audio file
	mysample = buffer;
  //send the buffer to the signal engine if required
  sema.sendBuffer('mysample', mysample);
  console.log("Sample loaded");
});

```

In the livecoding window (using the default language):

```
>{{1}imp}\mysample;
```

