//output overlapped windows of samples for a certain window size and hop size (for example, as postlude to short term Fourier transform)

//hopsize is length of cross fade, square or triangular window for now

//assumes hopsize <= windowsize/2

function MMLLOverlapAdd(windowsize=1024,hopsize=512,windowtype=0) {
    
    var self = this;
    
    self.windowsize = windowsize;
    
    if(hopsize>windowsize) hopsize = windowsize;
    
    self.hopsize = hopsize;
    self.overlap = windowsize - hopsize;
    
    self.store = new Array(windowsize);
    
    //start zeroed, will be summing to self buffer
    for (var ii=0; ii<self.windowsize; ++ii)
        self.store[ii] = 0;
        
    //self.outputpointer = 0; //self.overlap;

    //input is windowsize long, output will be hopsize long
    self.next = function(input,output) {
 
        //copy data backwards in store by hopsize
        
        var i;
        
        for (i=0; i<self.overlap; ++i) {
            
            self.store[i] = self.store[self.hopsize+i];
        }
        
        //zero end part
        
        for (i=0; i<self.hopsize; ++i) {
            
            self.store[self.hopsize+i] = 0.0;
        }
        
        //sum in new data, windowed appropriately
        
        if(windowtype==0) {
            
            for (var i=0; i<self.windowsize; ++i)
                self.store[i] += input[i];
            
                } else {
                    
                    //triangular windows for linear cross fade for now...
                    var prop;
                    var mult = 1.0/self.hopsize;
                    var index;
                    
                    for (var i=0; i<self.hopsize; ++i) {
                        
                        prop = i*mult;
                        
                        self.store[i] += input[i]*prop;
                        
                        index = self.windowsize-1-i;
                        
                        self.store[index] += input[index]*prop;
                    }
                    
                    for (var i=self.hopsize; i<self.overlap; ++i)
                        self.store[i] += input[i];
                    
                }
        
       
        for (var i=0; i<self.hopsize; ++i) {
            output[i] = self.store[i];
            
        }
        
        //return result;
        
    }
    
   

}

