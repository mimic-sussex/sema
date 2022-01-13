# Loading ML libraries

To load a machine learning (ML) library using the Javascript (JS) window use the `importScripts` command e.g.

```
//import tensorflow JS
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.4.0/dist/tf.min.js");
```

# If importScripts gives an error.

This is most likeley due to a CORS headers issue. A work around for this is to download the script and host it locally for sema to access.

1. Open a terminal and navigate to the folder where your script is.
2. Install live-server: https://www.npmjs.com/package/live-server
  - This can be done easily with NPM ```npm install -g live-server```
3. Run: ```live-server --cors```.  The ```---cors``` bit makes sure that you don't get any security problems when accessing the files.

When you run ```live-server``` it will open the url of the server in your browser. It will look something like ```http://127.0.0.1:8080/```


Then to load the script from your local server run ```importScripts("http://127.0.0.1:8080/YOUR_SCRIPT.js")```