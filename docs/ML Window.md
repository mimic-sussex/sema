# communicating with the audio engine

The audio engine sends data with @toJS.  This sends a data item, and a channel number, which is routed to the 'input' function in the ML window.  You can reply with the output function, e.g.

```
input = (x, id) => {
	console.log(">toModel: "+[id,x]);
	let prediction = test(x);
	console.log('Prediction: ',prediction);
	output(prediction, 0)
};

```

# data storage and loading

```
sema.saveF32Array(filename,data); // save to local storage in the browser

sema.download(filename); // download as file - filename will be appended with .data
```

Loading back into the code is asynchronous, so the data is assigned in the function coming back:

```
mydata = "";
sema.loadF32Array(fn,
    (v)=>{
        if ( v[0] != null ){
            mydata = v;  
        }
        console.log(fn);
    }
  )
```

# copy text to the clipboard

```
sema.pbcopy("some text to copy to the clipboard")
```

# Peer networking information

Find out your peer ID, to use with ```fromNet``` and ```toNet```

```
sema.peerinfo()
```
This will copy your peerID to the paste buffer

# create a buffer and send it to the audio engine

in the ML window:

```
a = new Float32Array(1000);

for(let i=0; i < a.length; i++) {
	a[i] = Math.sin(i/2) + (Math.random() -0.5);
	a[i] *= 1.0-(i/a.length);
}
sema.sendBuffer("newbuf",a)
```

in the live code window (default language):

```
{{1}imp}\newbuf
```


# record data from osc to a variable

Send data 20 times per second to the model, with id 0:

```
{20,0,/minibee/data}toModel
```

Receive in model and record to an array:

```
minibeedata = []
idx=0
record=1
input = (id,x) => {
    console.log("v: " + x);
    if (record) b[idx++] = x;
}
```

# graphics

You can create graphics from the ML window.  To enable this, you need to run your code in the top level DOM scope instead of the ML scope which runs in a worker thread.  You can do this in two ways:

```
sema.domeval(<code>);
```

or tag the first line of a block with
```
//--DOM
```

to run the whole block in DOM scope.

For example, this code creates an overlay with a lightening effect:
```
_______

//--DOM
//based on https://codepen.io/mcdorli/pen/AXgmPJ
var ctx;
var sizex = window.innerWidth;
var sizey = window.innerHeight;
var center = {x: sizex / 2, y: 20};
var minSegmentHeight = 5;
var groundHeight = sizey - 20;
var color = "hsl(180, 80%, 80%)";
var roughness = 2;
var maxDifference = sizex / 5;


function render() {
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillRect(0, 0, sizex, sizey);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 15;
  var lightning = createLightning();
  ctx.beginPath();
  for (var i = 0; i < lightning.length; i++) {
    ctx.lineTo(lightning[i].x, lightning[i].y);
  }
  ctx.stroke();
  requestAnimationFrame(render);
}

function createLightning() {
  var segmentHeight = groundHeight - center.y;
  var lightning = [];
  lightning.push({x: center.x, y: center.y});
  lightning.push({x: Math.random() * (sizex - 100) + 50, y: groundHeight + (Math.random() - 0.9) * 50});
  var currDiff = maxDifference;
  while (segmentHeight > minSegmentHeight) {
    var newSegments = [];
    for (var i = 0; i < lightning.length - 1; i++) {
      var start = lightning[i];
      var end = lightning[i + 1];
      var midX = (start.x + end.x) / 2;
      var newX = midX + (Math.random() * 2 - 1) * currDiff;
      newSegments.push(start, {x: newX, y: (start.y + end.y) / 2});
    }

    newSegments.push(lightning.pop());
    lightning = newSegments;

    currDiff /= roughness;
    segmentHeight /= 2;
  }
  return lightning;
}

var c = document.getElementById("canvas");
console.log(c);
c.style.visibility = 'visible';
c.style.opacity = 0.9;
c.width = window.innerWidth;
c.height = window.innerHeight;
ctx = c.getContext("2d");

ctx.globalCompositeOperation = "lighter";

ctx.strokeStyle = color;
ctx.shadowColor = color;

ctx.fillStyle = color;
ctx.fillRect(0, 0, sizex, sizey);
ctx.fillStyle = "hsla(0, 0%, 10%, 0.2)";

render();
```
