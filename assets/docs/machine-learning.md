# Enable hardware acceleration
This can greatly speed up the training process of any machine learning models.

Chrome users:
- Go to `chrome://settings`
- Click the Advanced ▼ button at the bottom of the page.
- In the **System section**, ensure the Use hardware acceleration when available checkbox is checked (you'll need to relaunch Chrome for any changes to take effect).

Firefox users:
- Go to `about:preferences`
- Scroll till you reach the **Performance section**, or simply search for "performance".
- Enable recommended performance settings, this will enable hardware acceleration if and when it is available.


# Loading ML libraries

To load a machine learning (ML) library using the Javascript (JS) window use the `importScripts` command e.g.

```
//import tensorflow JS
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.4.0/dist/tf.min.js");
```
