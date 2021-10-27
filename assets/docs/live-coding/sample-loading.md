# Default Samples

A range of samples are included by default in sema.

- `909`: Snare
- `909b`: Kick
- `909closed`: Closed hi-hat
- `909open`: Open hi-hat
- `click`: Clicking sound
- `spade`: Spade sound
- `boom2`: Explosion sound
- `boom`: Explosion sound
- `machine`: Mechanical sound
- `patterndrone2`: Drone sound
- `convol5`: Scraping sound
- `hapsi`
- `elstatic-old1`
- `dentist-old1`
- `flash-old1`
- `paper`
- `elstatic-old1`
- `clicks1`
- `zzzz`
- `xylophone`
- `rotatingIron`
- `convol2`
- `crackle3`
- `chainSpade`
- `birta`
- `InsectBee2`
- `Macrosemia`
- `lookout`
- `ravi`
- `dorje`
- `woodsamp`
- `holeMONO`


# Loading External Sound Files

You can load additional sound files in Sema through the JS window.  Sound files can either be sent to the signal engine as buffers, or used within the JS window (for example to train a machine learning model).

## Make the files available over a web connection (local or remote)

Sound files will be loaded over a http connection, so they need to be hosted on a web server. Currently samples can only be loaded from a local webserver. You can run a local webserver on your machine like this:

1. Open a terminal and navigate to the folder where your sound files are
2. Install live-server: https://www.npmjs.com/package/live-server
3. run: ```live-server --cors```.  The ```---cors``` bit makes sure that you don't get any security problems when accessing the files.

When you run ```live-server``` it will open the url of the server in your browser. It will look something like ```http://127.0.0.1:8080/```

## Load and decode 

Let's say you want to load a file called 'spoon.wav'. In the JS window:

```
/// import the aurora library.  There are further versions of this library that decode mp3, flac etc
importScripts("https://cdnjs.cloudflare.com/ajax/libs/aurora.js/0.4.2/aurora.min.js")
___
//if running locally, replace the port number with the one from your webserver - otherwise use the url from the remote server
var filename = 'spoon.wav'; // change this to the filename of your sample
var samplename = 'mysound'; // change this value the name you want to access your sample within sema

var asset = AV.Asset.fromURL(`http://127.0.0.1:8080/${filename}`); // directory where file is located.
var mysample;
asset.decodeToBuffer(function(buffer) {
  // buffer is now a Float32Array containing the entire decoded audio file
  mysample = buffer;
  //send the buffer to the signal engine if required
  sema.sendBuffer(samplename, mysample);
  console.log(`Sample ${filename} loaded as ${samplename}`);
});

```

## Play sample

In the livecoding window (using the default language):

```
>{{1}imp}\mysound;
```

## Loading more than one sample at a time

Below shows how you might load more than one file at once. Simply add to the array called ```fileList``` with your own filenames. The samples will then be accesible via their filenames minus the file extention. For example ```'spoon.wav'``` will be accesible in the default language as ```>{1}\spoon```.

```
/// import the aurora library.  There are further versions of this library that decode mp3, flac etc
importScripts("https://cdnjs.cloudflare.com/ajax/libs/aurora.js/0.4.2/aurora.min.js")
___
var fileList = ['gunshot.wav', 'bell.wav', 'horn.wav'] // put your own filenames here

// make the sample names in sema based on the filenames
let sampleNames = [];
for (let i=0; i<fileList.length; i++){
	sampleNames.push(fileList[i].substr(0, fileList[i].lastIndexOf('.')) || fileList[i]);
}

//load sounds from url
for (let i=0; i<sampleNames.length; i++){
	var asset = AV.Asset.fromURL(`http://127.0.0.1:8080/${fileList[i]}`); // directory where file is located.
	var mysample;
	asset.decodeToBuffer(function(buffer) {
		// buffer is now a Float32Array containing the entire decoded audio file
		mysample = buffer;
		//send the buffer to the signal engine if required
		sema.sendBuffer(sampleNames[i], mysample);
		console.log(`Sample ${fileList[i]} loaded as: ${sampleNames[i]}`);
	});
}
```