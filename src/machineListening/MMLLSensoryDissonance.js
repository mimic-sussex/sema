//William Sethares sensory dissonance algorithm adapted from my SuperCollider SensoryDissonance UGen code
//Sensory Dissonance model, measuring roughness between pairs of prominent spectral peaks. Follows the algorithm in William A. Sethares (1998) Consonance-Based Spectral Mappings. CMJ 22(1): 56-72

function MMLLSensoryDissonance(sampleRate,fftsize=2048,maxpeaks=100,peakthreshold=0.1,norm,clamp=5) {
    
    var self = this; 
    
    self.setup = function(sampleRate,fftsize=2048,maxpeaks=100,peakthreshold=0.1,norm,clamp=5) {
        var i;
        
        self.m_srate = sampleRate;
        self.fftsize_ = fftsize;
        
        self.stft = new MMLLSTFT(self.fftsize_,self.fftsize_/2,0);
        
        //for(i=0; i<12; ++i)
        
        self.maxnumpeaks_ = maxpeaks; //100;
        self.peakthreshold_ = peakthreshold;
        self.peakfreqs_ =  new Array(self.maxnumpeaks_);
        self.peakamps_ = new Array(self.maxnumpeaks_);
        
        self.norm_ = (typeof norm !== 'undefined') ?  norm : 0.01/maxpeaks;
        
        self.clamp_ = clamp;
        
        self.topbin_= self.fftsize_*0.25;  //only go up to half the frequency range (i.e., there are half fftsize bins)
        self.frequencyperbin_ = self.m_srate / self.fftsize_;
        
        self.dissonance_ = 0;
        
    }
    
    self.setup(sampleRate,fftsize,maxpeaks,peakthreshold,norm,clamp);
    
    //must pass in fft data (power spectrum)
    self.next = function(input) {
        
        var i,j;
        
        var ready = self.stft.next(input);
        
        if(ready) {
            
            
            var fftbuf = self.stft.powers;
            
            
            var peakfreqs= self.peakfreqs_;
            var peakamps= self.peakamps_;
            
            var real, imag;
            
            var numpeaks = 0;
            var maxnumpeaks = self.maxnumpeaks_;
            
            var intensity;
            var position;
            
            var threshold = self.peakthreshold_;
            
            //create powerspectrum
            
            var prev=0.0, now=0.0, next=0.0;
            
            var frequencyperbin = self.frequencyperbin_;
            
            //float totalpeakpower = 0.0f;
            var temp1, refinement;
            
            for (j=1; j<=self.topbin_; ++j) {
                
                intensity = fftbuf[j];
                
                next = intensity;
                
                if(j>=3) {
                    
                    //hunt for peaks
                    
                    //look for peak by scoring within +-3
                    //assume peak must be centrally greater than 60dB say
                    
                    //powertest_
                    //minpeakdB_ was 60
                    
                    if (now>threshold)  {
                        
                        //y1= powerspectrum_[i-1];
                        //				//y2= valuenow;
                        //				y3= powerspectrum_[i+1];
                        //
                        if ((now>prev) && (now>next)) {
                            
                            //second peak condition; sum of second differences must be positive
                            //NCfloat testsum= (valuenow - powerspectrum_[i-2]) + (valuenow - powerspectrum_[i+2]);
                            
                            //if (testsum>0.0) {
                            
                            //refine estimate of peak using quadratic function
                            //see workbook 28th Jan 2010
                            
                            temp1 = prev+next-(2*now);
                            
                            if (Math.abs(temp1)>0.00001) {
                                position=(prev-next)/(2*temp1);
                                
                                //running quadratic formula
                                refinement = (0.5*temp1*(position*position)) + (0.5*(next-prev)*position) + now;
                                //refinement= y2 -  (((y3-y1)^2)/(8*temp1));
                                
                            } else {
                                //degenerate straight line case; shouldn't occur
                                //since require greater than for peak, not equality
                                
                                position=0.0; //may as well take centre
                                
                                //bettervalue= max([y1,y2,y3]); %straight line through them, find max
                                
                                refinement= now; //must be max for else would have picked another one in previous calculation! %max([y1,y2,y3]);
                                
                            }
                            
                            //correct??????????????????????????????
                            peakfreqs[numpeaks] = (j-1+position)*frequencyperbin; //frequencyconversion;
                            //printf("peakfrequencies %d is %f from i %d position %f freqperbin %f \n", numpeaks_,peakfrequencies_[numpeaks_],i, position, frequencyperbin_);
                            
                            peakamps[numpeaks] = Math.sqrt(refinement); //Sethares formula requires amplitudes
                            //totalpeakpower += refinement;
                            
                            //cout << " peak " << numpeaks_ << " " << peakfrequencies_[numpeaks_] << " " << refinement << " " ;
                            
                            ++numpeaks;
                            
                            //}
                            
                        }
                        
                    }
                    
                    //test against maxnumberpeaks_
                    if ( numpeaks == maxnumpeaks )
                        break;
                    
                    
                    
                }
                
                prev = now; now=next;
                
            }
            
            
            //now have list of peaks: calculate total dissonance:
            
            //iterate through peaks, matching each to min of next 10, and no more than octave, using Sethares p. 58 CMJ article
            
            var dissonancesum = 0;
            
            var f1, v1, f2, v2;
            var d;
            var diff; //, minf;
            var s, a, b;
            var octave;
            var upper;
            
            for (i=0; i<(numpeaks-1); ++i) {
                
                f1 = peakfreqs[i];
                v1 = peakamps[i];
                s = 0.24/(0.21*f1+19); //constant needed as denominator in formula
                a = -3.5*s;
                b= -5.75*s;
                
                octave = 2*f1;
                
                upper = i+20;
                
                if(upper>numpeaks) upper = numpeaks;
                
                for (j=i+1; j<upper; ++j) {
                    
                    f2 = peakfreqs[j];
                    v2 = peakamps[j];
                    
                    if(f2>octave) break; //shortcut escape if separated by more than an octave
                    
                    diff = f2-f1; //no need for fabs, f2>f1
                    //minf =  //always f1 lower
                    
                    d = v1*v2*(Math.exp(a*diff) - Math.exp(b*diff));
                    
                    dissonancesum += d;
                }
                
            }
            
            dissonancesum *= self.norm_;
            
            if(dissonancesum>self.clamp_) dissonancesum = self.clamp_;
            
            self.dissonance_ = dissonancesum;
            //self.dissonance_ = sc_min(self.clamp_,dissonancesum*self.norm_); //numpeaks; //dissonancesum;  //divide by fftsize as compensation for amplitudes via FFT
            
        }
        
        
        //ZOUT0(i) = self.dissonance_;
        return self.dissonance_;
        
        //return ready;
        
    }
    
    
}


