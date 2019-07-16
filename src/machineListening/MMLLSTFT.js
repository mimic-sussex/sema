//short term Fourier transform
//currently just calculates power spectrum, could modify later for phase spectrum etc

function MMLLSTFT(fftsize=1024,hopsize=512,windowtype=0,postfftfunction) {
    
    var self = this;
    
    self.fftsize = fftsize;
    self.hopsize = hopsize; //typically halffftsize, but windowing should cope otherwise too
    self.halffftsize = fftsize/2;
    self.windowtype = windowtype;
    self.postfftfunction = postfftfunction;
    
    self.windowing= new MMLLwindowing(self.fftsize,self.hopsize);
    //self.fft = new MMLLFFT(); //
    self.fft = new FFTR(fftsize);
    
    //self.fft.setupFFT(fftsize);
    
    self.windowdata = new Float32Array(self.fftsize); //begins as zeroes
    self.hanning = new Float32Array(self.fftsize);
    
    var ang=(2.0*Math.PI)/self.fftsize;
    
    for(var i=0;i<fftsize;++i)
        self.hanning[i]=0.5 - 0.5*Math.cos(ang*i);
    
    //initialised containing zeroes
    self.powers = new Float32Array(self.halffftsize);
    //var freqs = result.subarray(result.length / 2);
    self.reals = new Float32Array(self.fftsize);
    
    self.complex = new Float32Array(self.fftsize+2);
    
    //self.imags = new Float32Array(self.fftsize);
    
    //4 =2*2 compensates for half magnitude if only take non-conjugate part, fftsize compensates for 1/N
    self.fftnormmult = 4*self.fftsize; //*fftsize;// /4; //1.0/fftsize;  or 1/(fftsize.sqrt)
    
    self.next = function(input) {
        
        //update by audioblocksize samples
        var ready = self.windowing.next(input);
        
        if(ready) {
            
            //no window function (square window)
            if(self.windowtype==0) {
            for (i = 0; i< self.fftsize; ++i) {
                self.reals[i] = self.windowing.store[i]; //*hanning[i];
                //self.imags[i] = 0.0;
                
            }
            } else {
                for (i = 0; i< self.fftsize; ++i) {
                    self.reals[i] = self.windowing.store[i]*self.hanning[i];
                    //self.imags[i] = 0.0;
                    
                }
            }
  
            //fft library call
            //self.fft.transform(self.reals, self.imags);
            //var output = self.fft.forward(self.reals);
            
            self.fft.forward(self.reals,self.complex);
            
            //output format is interleaved k*2, k*2+1 real and imag parts
            //DC and 0 then bin 1 real and imag ... nyquist and 0
            
            //power spectrum not amps, for comparative testing
            for (var k = 0; k < self.halffftsize; ++k) {
                //Math.sqrt(
                var twok = 2*k;
                //self.powers[k] = ((output[twok] * output[twok]) + (output[twok+1] * output[twok+1]) ); // * fftnormmult;
                
                self.powers[k] = ((self.complex[twok] * self.complex[twok]) + (self.complex[twok+1] * self.complex[twok+1]) );
                
                //will scale later in onset detector itself
                
                //self.powers[k] = ((self.reals[k] * self.reals[k]) + (self.imags[k] * self.imags[k]) ); // * fftnormmult;
                
                //freqs[k - align] = (2 * k / N) * (sample_rate / 2);
            }
            
            //console.log(self.postfftfunction,'undefined');
            
            if(self.postfftfunction !== undefined)
            self.postfftfunction(self.powers,self.complex); //could pass self.complex as second argument to get phase spectrum etc
            
            
        }
        
        return ready;
        
    }
    
   

}

