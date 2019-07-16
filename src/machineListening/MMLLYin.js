//(c) Nick Collins 2019
//De Cheveigné, A. and Kawahara, H., 2002. YIN, a fundamental frequency estimator for speech and music. The Journal of the Acoustical Society of America, 111(4), pp.1917-1930.

//could make version updated every sample, with maxtau delay lines
//and recursive update (remove previous value, add new squared difference each sample step, occasional full recalculation to avoid accumulating numerical errors)
//however only want one output per block, not one per sample

//inefficient if calculated naively over all tau and full window size (70-85% CPU)
//reduce search range between minimum and maximum periods
//cache calculations per block, only update for new block (down to around 25% CPU)


function MMLLYin(sampleRate,blocksize,minFreq=65,maxFreq=1700) {
    
    var self = this; 
    
self.setup = function(sampleRate) {
	var i;
 
    self.m_srate = sampleRate;
    self.blocksize = blocksize;
    
	self.m_minfreq = minFreq; //30; //ZIN0(5);
	self.m_maxfreq = maxFreq; //2000; //ZIN0(6);
	
    self.maxtau = Math.floor(sampleRate/minFreq);
    self.mintau = Math.floor(sampleRate/maxFreq);
    
    self.differencefunction = new Array(self.maxtau+1); //so can use tau as index into array
    
    //"cumulative mean normalized difference function"
    self.differencedashfunction = new Array(self.maxtau+1); //so can use tau as index into array
    
    self.numcaches = Math.ceil(self.maxtau/self.blocksize);
    self.samplestoresize = self.numcaches * self.blocksize;
    self.caches = new Array(self.numcaches);
    self.cachepos = 0;
    
    
    self.numtau = self.maxtau -self.mintau + 1;
    
    for(i=0; i<self.numcaches; ++i) {
        self.caches[i] = new Array(self.numtau);
        
        for(j=0; j<self.blocksize; ++j)
            self.caches[i][j] = 0;
    }
    
    
    //make sure at least twice size of maxtau
    //self.movingwindow = new MMLLwindowing(2*self.maxtau,blocksize);
    
    self.movingwindow = new MMLLwindowing(self.maxtau + self.samplestoresize,blocksize);
    
    //self.previoussamples = new Float32Array(maxtau);

    self.threshold = 0.1;
    
    self.m_midipitch = 69;
	self.m_currfreq=440;
	self.m_hasfreq=0;
    
}

self.setup(sampleRate);
    

self.next = function(input) {

    var i,j;
    var sum,diff;
    var startindex;
    var n = input.length;

    //check threshold using powers
    var ampthresh = 0.01;
    
    var ampok = false;
    
    for (j = 0; j < n; ++j) {
        if (Math.abs(input[j]) >= ampthresh) {
            ampok = true;
            break;
        }
    }
    
    if(ampok) {
        self.m_hasfreq = 1;
    }	else {self.m_hasfreq = 0;}
    

    
    var ready = self.movingwindow.next(input);
    
    if(ready) {
    
        //most recent at later parts of this window of data
        var x = self.movingwindow.store;
        
        //update cache
        
        self.caches[i]
        
        //over each lag
        for(i=self.mintau; i<=self.maxtau;++i) {
            
            sum = 0;
            
            startindex = x.length - self.blocksize - i;
            
            //sum differences
            for(j=0; j<self.blocksize;++j) {
                
                diff = x[startindex+j]-x[startindex+j+i];
                
                sum += diff*diff;
                
            }
            
            self.caches[self.cachepos][i] = sum;
            
        }

        
        for(i=self.mintau; i<=self.maxtau;++i) {
            
            sum = 0.0;
            
            for(j=0; j<self.numcaches;++j) {
                
                sum += self.caches[j][i];
            }
            
            self.differencefunction[i] = sum;
        }
        
        
        self.cachepos = (self.cachepos+1)%(self.numcaches);
        
        
//        
//        //over each lag
//        for(i=self.mintau; i<=self.maxtau;++i) {
//            
//            sum = 0;
//            
//            startindex = x.length - self.maxtau - i;
//            
//            //sum differences
//            for(j=0; j<self.maxtau;++j) {
//            
//                diff = x[startindex+j]-x[startindex+j+i];
//                
//                sum += diff*diff;
//                
//            }
//            
//            self.differencefunction[i] = sum;
//            
//        }
//        
        
        sum = 0;
        
        //step 3 : Cumulative mean normalized difference function
        for(i=self.mintau; i<=self.maxtau;++i) {
            
            sum += self.differencefunction[i];
            
            self.differencedashfunction[i] = i * self.differencefunction[i]/sum;
        }
        
        
        
        var winner = -1;
        //step 4: threshold
        for(i=self.mintau; i<=self.maxtau;++i) {
            
            if(self.differencedashfunction[i]<self.threshold) {
                
                winner = i;
                break;
                
            }
        }
        
        
        if(winner>(-1)) {
            
            //step 5: parabolic interpolation, using differencefunction, not differencedashfunction
            //only works if neighbours exist, so 1<winner<self.maxtau
            
            var refinedestimate = winner;
            
            if((winner>1) && (winner<self.maxtau)) {
            
            var prev = self.differencefunction[winner-1];
            var next = self.differencefunction[winner+1];
            var now = self.differencefunction[winner];
            
            var temp = (2*now)-prev-next;
            
            if (Math.abs(temp)>0.00001) {
                
                refinedestimate += (0.5*(next-prev)/temp);
                
            } else {
                //degenerate straight line case
                
                //may as well take centre
                
                //so do nothing
                
            }
            
            
            }
            
            
            //step 6 "shop around" in local time window
            
            //requires keeping previous differencedashfunction arrays
            
            //leave for now
            
            
            self.m_currfreq = self.m_srate/refinedestimate;
            
            self.m_midipitch = (Math.log2(self.m_currfreq/440) * 12) + 69; //(((log2(m_currfreq/440.0)) * 12) + 69); //as MIDI notes
            
           
            
            
        } else {
            self.m_hasfreq = 0;
        }
        
        
        
    }
    
    return self.m_currfreq; //m_midipitch;
    
  }


    

    
}


