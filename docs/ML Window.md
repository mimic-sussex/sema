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
