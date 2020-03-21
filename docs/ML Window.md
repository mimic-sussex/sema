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
