//gather data for a certain window size and hop size (for example, as prelude to short term Fourier transform)

//MMLL = Musical Machine Listening Library MMLL.js
function MMLLwindowing(windowsize=1024,hopsize=512) {
    
    var self = this;
    
    self.windowsize = windowsize;
    
    if(hopsize>windowsize) hopsize = windowsize;
    
    self.hopsize = hopsize;
    self.overlap = windowsize - hopsize;
    
    self.store = new Array(windowsize);
    
    //only zero old data
    for (var ii=0; ii<self.overlap; ++ii)
        self.store[ii] = 0;
        
    self.storepointer = self.overlap;

    self.next = function(input) {
        
        var n = input.length; //code assumes n divides hopsize
        
        var result = false;
        
        
        //if just output a window of data
        //copy and update storepointer position
        if(self.storepointer>=self.windowsize) {
            
            for (var i=0; i<self.overlap; ++i)
                self.store[i] = self.store[self.hopsize+i];
                
                self.storepointer = self.overlap;
           
            
            
        }
        
        if((self.storepointer+n)>=self.windowsize) {
            n = self.windowsize - self.storepointer;
            //just in case doesn't fit exactly, don't bother if really going to wrap around since unresolvable issue if  overwrite buffer or multiple wraps in one go anyway
            
            result = true;
            
        }
        for (var i=0; i<n; ++i) {
            self.store[self.storepointer+i] = input[i];
            
        }
        
        
        self.storepointer = (self.storepointer + n); //%(self.windowsize);
     
        
//        if(self.storepointer ==0) {
//         
//            console.log("back to zero index");
//        }
 
        return result;
        
    }
    
   

}

