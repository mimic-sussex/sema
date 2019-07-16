//adapted from my SuperCollider UGen TPV
//itself based on
//Tracking Phase Vocoder following McAulay and Quatieri model from IEEE Trans acoustics, speech and signal processing vol assp-34(4) aug 1986

//ASSUMES BLOCKSIZE <= HOPSIZE can't calculate two FFTs per block


function PartialTrack() {
//	var theta1, omega1, theta2, omega2, alpha, beta; //cubic interpolation of phase
//	var amp1, amp2; //linear interpolation of amplitude
//    
    this.theta1 = 0;
    this.omega1 = 0;
    this.theta2 = 0;
    this.omega2 = 0;
    this.alpha = 0;
    this.beta = 0;
    this.amp1 = 0;
    this.amp2 = 0;
    
};


//freq in self case is omega, angular frequency in radians per sample = 2*PI*f/SR
function TPVPeak() {
	//var mag, freq, phase;  //improve frequency estimate by interpolation over amplitude of nearby points, or by time-frequency reassignment
    
    this.mag = 0;
    this.freq = 0;
    this.phase = 0;
    
};

//peak must satisfy amp(freq at index i-1)<amp(freq at index i)>amp(freq at index i+1), then cubic interpolation over local points (see wavetable interpolation code for processing)


//final list of peaks is size at most numpeaks(n) + numpeaks(n+1). reasonably around max of the two.
//as long as have birth and death resolved for each peak in the two lists, can synthesise up to curent frame. So output latency is one FFT frame


function MMLLTrackingPhaseVocoder(sampleRate,windowsize=1024, hopsize=512, maxpeaks=80, currentpeaks=40, freqmult=1.0, tolerance=4, noisefloor= 0.04) {
    
    var self = this;
    
    var i, j, temp;
    
    self.g_costableTPVsize = 1024;
    self.g_costableTPV = new Array(self.g_costableTPVsize+1); //extra value for wraparound linear interpolation calculations
    
    var g_costableTPVsizereciprocal = 1.0/ self.g_costableTPVsize;
    
    for (i=0; i<=self.g_costableTPVsize; ++i) {
        
        //2pi * (i/tablesize)
		temp = 6.2831853071796*(i * g_costableTPVsizereciprocal);
		
        self.g_costableTPV[i] = Math.cos(temp); //or sin
        
		//printf("cos check %d %f",i,g_costableTPV[i]);
        
	}

    
    //    self.previousfftdata = new Array(1024*self.numpreviousframes);
    // for(i=0; i<(1024*self.numpreviousframes); ++i)
  
   
self.setup = function(sampleRate) {
	var i;
    
    self.m_windowsize = windowsize; //defaults for now, may have to set as options later
	self.m_hopsize = hopsize;
    self.currentpeaks = currentpeaks;
    self.freqmult = freqmult;
    self.tolerance = tolerance;
    self.noisefloor = noisefloor;
    
    self.m_maxpeaks = maxpeaks;
    
    
    self.stft = new MMLLSTFT(self.m_windowsize,self.m_hopsize,1); //Hanning window better for peak detection rather than rectangular
    
    
	//self.tcache=  (float*)RTAlloc(self.mWorld, self.m_hopsize * sizeof(float));
	self.t2cache =  new Float32Array(self.m_hopsize );
	self.t3cache = new Float32Array(self.m_hopsize );
	self.tpropcache =  new Float32Array(self.m_hopsize );
    
	var rhop= 1.0/self.m_hopsize;
    
	for (i=0; i<self.m_hopsize; ++i) {
		self.t2cache[i] = i*i;
		self.t3cache[i] = self.t2cache[i] * i;
		self.tpropcache[i] = i*rhop;
	}

	self.m_nover2 = self.m_windowsize/2;

	
    self.maxnumtracks = 2*self.m_maxpeaks;
    
	self.m_tracks= new Array(self.maxnumtracks);
    
	for (i=0; i<self.maxnumtracks; ++i) {
        
        self.m_tracks[i] = new PartialTrack();
        
//        self.m_tracks[i].theta1 = 0.0;
//        self.m_tracks[i].theta2 = 0.0;
//        self.m_tracks[i].omega1 = 0.0;
//        self.m_tracks[i].omega2 = 0.0;
//        self.m_tracks[i].alpha = 0.0;
//        self.m_tracks[i].beta = 0.0;
//        self.m_tracks[i].amp1 = 0.0;
//        self.m_tracks[i].amp2 = 0.0;
        
        
        
    }
  
    self.m_prevpeaks = new Array(self.m_maxpeaks);
    
    self.m_newpeaks = new Array(self.m_maxpeaks);
    
    for (i=0; i<self.m_maxpeaks; ++i) {
        
        self.m_prevpeaks[i] = new TPVPeak();
        self.m_newpeaks[i] = new TPVPeak();
        
        //mag, freq, phase;
//        self.m_prevpeaks[i].mag = 0.0;
//        self.m_prevpeaks[i].freq = 0.0;
//        self.m_prevpeaks[i].phase = 0.0;
//        self.m_newpeaks[i].mag = 0.0;
//        self.m_newpeaks[i].freq = 0.0;
//        self.m_newpeaks[i].phase = 0.0;
        
    }
  
	self.m_numprevpeaks = 0;
	self.m_numnewpeaks = 0;
	self.m_numtracks= 0;
	self.m_resynthesisposition = 0;

}

    self.setup(sampleRate);

    
    
    
    
    
    
    
    
self.newframe = function(complex,powers) {

        //only calculate phases for peaks, use power spectrum for peak detection rather than magnitude spectrum, then only take sqrt as needed
    
        //assumed in self representation
        //dc, nyquist then complex pairs
    
        //swap new peaks to old; current now safe to overwrite;
    
        //just copy data over
    
    
    for (i=0; i<self.m_maxpeaks; ++i) {

        self.m_prevpeaks[i].mag = self.m_newpeaks[i].mag;
        self.m_prevpeaks[i].freq = self.m_newpeaks[i].freq;
        self.m_prevpeaks[i].phase = self.m_newpeaks[i].phase;
    
    }
    
        //ditch old
        self.m_numprevpeaks = self.m_numnewpeaks;
        self.m_numnewpeaks = 0;
    
        
        var phase, prevmag, mag, nextmag;
        
        //bin 1 can't be pick since no interpolation possible! dc should be ignored
        //test each if peak candidate; if so, add to list and add to peaks total
        
        //prevmag = p->bin[0].mag; //self is at analysis frequency, not dc
        //mag = p->bin[1].mag;
    
        prevmag = powers[1];
        mag = powers[2];
    
    
        var numpeaksrequested = self.currentpeaks; //(int)ZIN0(4); //(int)(ZIN0(4)+0.0001);
        var maxpeaks = self.m_maxpeaks;
    
        if(maxpeaks>numpeaksrequested) maxpeaks = numpeaksrequested
    
        //maxpeaks = sc_min(maxpeaks,numpeaksrequested);
    
    
    
        //angular frequency is pi*(i/nover2)
        
        var angmult= 3.1415926535898/self.m_nover2;
        var ampmult= (1.0/self.m_windowsize); //*(1.0/self.m_maxpeaks);
        
		//defined here since needed in backdating phase for track births (and potentially for track deaths too)
        //T = number of samples per interpolaion frame, so equals hopsize
        var T = self.m_hopsize;
        
        //float invT= 1.0/T;
        
        //should also adjust tolerance? (ie change angmult itself)
        //float freqmult= ZIN0(5); //(int)(ZIN0(4)+0.0001);
    
    //really powercheck
    var ampcheck = self.noisefloor; // * noisefloor; // power check ZIN0(7); //0.001
    
    var real,imag;
    
        //could restrict not to go above nover4!
        for (i=3; i<(self.m_nover2-1); ++i) {
            
            //phase= p->bin[i].phase;
            nextmag = powers[i]; //p->bin[i].mag;
            
            if ((prevmag<mag) && (nextmag<mag) && (mag>ampcheck) && (self.m_numnewpeaks<maxpeaks)) {
                //found a peak
                
                //could use cubic interpolation// successive parabolic interpolation to refine peak location; or should have zero padded
                self.m_newpeaks[self.m_numnewpeaks].mag = Math.sqrt(mag) * ampmult; //must divide by fftsize before resynthesis!
                self.m_newpeaks[self.m_numnewpeaks].freq =(i-1)*angmult*self.freqmult; //if should be angular frequency per sample, divide by T
                
                real = complex[2*i-2];
                imag = complex[2*i-1];
                
                self.m_newpeaks[self.m_numnewpeaks].phase = Math.atan(imag, real); //p->bin[i-1].phase;	//is self in range -pi to pi? more like -1 to 5 or so, but hey, is in radians
                
                //printf("newpeak %d amp %f freq %f phase %f \n",numnewpeaks, mag * ampmult,(i-1)*angmult, p->bin[i-1].phase);
                
                ++self.m_numnewpeaks;
                
            }
            
            prevmag=mag;
            mag=nextmag;
            
        }

        
        //now peak matching algorithm
        var rightsort = 0;
        var flag = true;
    
        var tracks = self.m_tracks;
        var numtracks = 0; //self.m_numtracks;
        
        //increase tolerance
        var tolerance = self.tolerance; //ZIN0(6)*angmult;
    
        var testfreq;
    
        //ASSUMES BOTH PEAKS LISTS ARE IN ORDER OF INCREASING FREQUENCY
        
        //while right less than left-tolerance then birth on right
        
        //if right within tolerance, find closest; if less than, match, else must check next on left whether better match. If not, match, else, check previous on right. If within tolerance, match, else death on right.
        
        //step through prevpeaks
        for (i=0; i<self.m_numprevpeaks; ++i) {
            
            var freqnow = self.m_prevpeaks[i].freq;
            
            flag = true;
            
            while(flag) {
                
                if(rightsort>=self.m_numnewpeaks) {flag=false;} else {
                    testfreq= self.m_newpeaks[rightsort].freq;
                    
                    if((testfreq+tolerance)<freqnow) {
                        //birth on right
                        tracks[numtracks].omega1 = self.m_newpeaks[rightsort].freq;
                        tracks[numtracks].theta2 = self.m_newpeaks[rightsort].phase;
                        tracks[numtracks].omega2 = self.m_newpeaks[rightsort].freq; //match to itself
                        tracks[numtracks].theta1 = self.m_newpeaks[rightsort].phase - (T*(self.m_newpeaks[rightsort].freq)); //should really be current phase + freq*hopsize
                        tracks[numtracks].amp1 = 0.0;
                        tracks[numtracks].amp2 = self.m_newpeaks[rightsort].mag;
                        ++numtracks;
                        ++rightsort;
                        
                    } else {
                        
                        flag=false;
                        
                    }
                    
                }
                
            }
            
            flag=false; //whether match process fails
            if(rightsort>=self.m_numnewpeaks) {flag=true;} else {
				//printf("testfreq %f freqnow %f tolerance %f \n ", testfreq, freqnow, tolerance);
                
                //assumption that testfreq already valid;
                if (testfreq>(freqnow+tolerance)) {flag=true;} else {
                    
                    //now have a candidate. search for closest amongst remaining; as soon as no closer, break
                    //printf("candidate! \n ");
                    
                    var bestsofar = Math.abs(freqnow - testfreq);
                    var bestindex = rightsort;
                    
                    for (j=(rightsort+1); j<self.m_numnewpeaks; ++j) {
                        var newcandidate = self.m_newpeaks[j].freq;
                        var newproximity = Math.abs(newcandidate-freqnow);
                        
                        //must keep getting closer, else no use
                        if(newproximity<bestsofar) {bestindex = j; bestsofar = newproximity;}
                        else break; //nothing better
                    }
                    
                    //now have closest estimate. If less than freqnow have match
                    var closest = self.m_newpeaks[bestindex].freq;
                    var havematch = false;
                    
                    //printf("closest! %f bestindex %d rightsort %d \n ", closest, bestindex, rightsort);
                    
                    if(closest<freqnow || (i==(self.m_numprevpeaks-1))) havematch=true;
                    else { //test next i as available in self case
                        
                        var competitor = self.m_prevpeaks[i+1].freq;
                        
                        if (Math.abs(competitor-closest)<bestsofar) {
                            
                            //if no alternative
                            if (bestindex == rightsort) flag= true; //failure to match anything
                            else {bestindex = rightsort-1;
                                havematch = true;
                            }
                            
                        } else
                            havematch=true;
                        
                    }
                    
                    if(havematch) {
                        
                        //int newrightsort= bestindex;
                        //if() newrightsort=
                        
                        //TIDY UP ANY CANIDATES MISSED OUT BY THIS PROCESS
                        
                        for (j=rightsort; j<=(bestindex-1);++j) {
                            //BIRTHS ON RIGHT
                            
                            tracks[numtracks].omega1=self.m_newpeaks[j].freq;
                            tracks[numtracks].theta2=self.m_newpeaks[j].phase;
                            tracks[numtracks].omega2=self.m_newpeaks[j].freq; //match to itself
                            
                            temp = self.m_newpeaks[j].phase - (T*(self.m_newpeaks[j].freq));
                                    
                            temp = (temp % 6.2831853071796 + 6.2831853071796)%6.2831853071796;
                            
                            tracks[numtracks].theta1 = temp; //sc_wrap(newpeaks[j].phase - (T*(self.newpeaks[j].freq)),0.0f,(float)twopi); //backcalculate starting phase
                            tracks[numtracks].amp1 = 0.0;
                            tracks[numtracks].amp2 = self.m_newpeaks[j].mag;
                            ++numtracks;
                            ++rightsort;
                        }
                        
                        //printf("match! \n ");
                        
                        //MATCH!
                        tracks[numtracks].theta1 = self.m_prevpeaks[i].phase;
                        tracks[numtracks].omega1 = self.m_prevpeaks[i].freq;
                        tracks[numtracks].theta2 = self.m_newpeaks[rightsort].phase; //match to itself; should really be current phase + freq*hopsize
                        tracks[numtracks].omega2 = self.m_newpeaks[rightsort].freq; //match to itself
                        tracks[numtracks].amp1 = self.m_prevpeaks[i].mag;
                        tracks[numtracks].amp2 = self.m_newpeaks[rightsort].mag;
                        
                        //yes, OK
                        //printf("amp check i %d amp1 %f amp2 %f source1 %f source2 %f\n",i,tracks[numtracks].amp1, tracks[numtracks].amp2, prevpeaks[i].mag, newpeaks[rightsort].mag);
                        ++numtracks;
                        ++rightsort;
                        
                        //rightsort=bestindex+1;
                        
                    }
                    
                    //if was flag==true, then none missed out, still on rightsort
                    
                }
                
            }
            
            
            //match failed, death on left
            if (flag==true) {
                
                //DEATH ON LEFT
                
                //death on left
                tracks[numtracks].theta1 = self.m_prevpeaks[i].phase;
                tracks[numtracks].omega1 = self.m_prevpeaks[i].freq;
                
                temp = self.m_prevpeaks[i].phase + (T*self.m_prevpeaks[i].freq)
                        
                temp = (temp % 6.2831853071796 + 6.2831853071796)%6.2831853071796;
                        
                tracks[numtracks].theta2 = temp; //sc_wrap(prevpeaks[i].phase + (T*prevpeaks[i].freq),0.0f,(float)twopi); //match to itself; should really be current phase + freq*hopsize
                tracks[numtracks].omega2 = self.m_prevpeaks[i].freq; //match to itself
                tracks[numtracks].amp1 = self.m_prevpeaks[i].mag;
                tracks[numtracks].amp2 = 0.0;
                ++numtracks;
                
                //ADDCODE
                //++leftsort;
            }
            
        }
        
        //rightsort should equal numnewpeaks!
        
        //now iterate through PartialTracks, preparing them for synthesis
        self.m_numtracks = numtracks;
        
        var theta1, omega1, theta2, omega2; //, amp1, amp2;  //, alpha, beta
        
        var M;
        var Tover2= T/2.0;
        //float oneovertwopi = 1.0/(2*PI);
        var temp1, temp2;
        
        //matrix elements common to all track calculations: eqn (34)
        //for hyperefficiency could precalculate some of self material in constructor of course...
        var r1c1=3.0/(T*T);
        var r1c2= (-1.0)/T;
        var r2c1= (-2.0)/(T*T*T);
        var r2c2= 1.0/(T*T);
        
        //printf("matrix checks %f %f %f %f \n",r1c1,r1c2,r2c1,r2c2);
        
        var rtwopi = 0.1591549430919;
        
        //precalculate cubic interpolation parameters alpha and beta as per eqn (37) in McAulay and Quatieri
        //must go via M, the integer of extra phase for theta2
        for (i=0; i<numtracks; ++i) {
            
			theta1 = tracks[i].theta1;
			theta2 = tracks[i].theta2;
			omega1 = tracks[i].omega1;
			omega2 = tracks[i].omega2;
            
			//rpitwo= 1/2pi see SC_constants
			//round off as (int)(0.5+val)
			var mtemp = rtwopi*((theta1 + (omega1*T) - theta2) + ((omega2-omega1)*Tover2) );
            
			if(mtemp<0.0)
                M = Math.floor(mtemp-0.5);
			else
                M = Math.floor(mtemp+0.5);
            
			temp1 = theta2 - theta1 - (omega1*T) + (6.2831853071796*M);
			temp2 = omega2-omega1;
            
			//matrix solution
			tracks[i].alpha = r1c1*temp1 + r1c2*temp2;
			tracks[i].beta = r2c1*temp1 + r2c2*temp2;
            
			//if(i==20) {
			//printf("track check %d theta1 %f theta2 %f omega1 %f omega2 %f amp1 %f amp2 %f M %d alpha %f beta %f \n",i,theta1,theta2,omega1,omega2,tracks[i].amp1, tracks[i].amp2,M,tracks[i].alpha, tracks[i].beta);
			//}
        }
        
        
        //struct PartialTrack {
        //float theta1, omega1, theta2, omega2, alpha, beta; //cubic interpolation of phase
        //float startamp, endamp; //linear interpolation of amplitude
        //};
        
        
        
    }
    
    
    
    
    
    
    
    
//can dynamically reduce or increase the number of peaks stored (trails will automatically birth and die)
    
//must pass in fft data (power spectrum)
self.next = function(input,out,numSamples) {

    var i,j;
 
    var ready = self.stft.next(input);
    
    if(ready) {
    
        var fftbuf = self.stft.complex; //powers;
        var powers = self.stft.powers;
        
        self.newframe(fftbuf,powers);
        
		self.m_resynthesisposition=0;
    
      
  }

	//implement here in code
	//oscillatorbankresynthesis
 
	//zero output first in case silent output
	for (j=0; j<numSamples; ++j) {
		out[j]=0.0;
	}
    
    var t,t2,t3;
	var tpos;
	var index;
    var amp,amp1,amp2,phase,phasetemp,wrapval,prev,prop,interp;
    var amp1, amp2, theta1, omega1, alpha, beta;
    
    var tracknow;
    
	//printf("numtracks %d \n", numtracks);
    
	for (i=0; i<self.m_numtracks; ++i) {
   
        tracknow = self.m_tracks[i];
        
		amp1 = tracknow.amp1;
		amp2 = tracknow.amp2;
		theta1 = tracknow.theta1;
		omega1 = tracknow.omega1;
		alpha = tracknow.alpha;
		beta = tracknow.beta;
        
		for (j=0; j<numSamples; ++j) {
            
			index = self.m_resynthesisposition+j;
            
			t = index; ///T;
			t2 = self.t2cache[index]; //t*t;
			t3 = self.t3cache[index]; //t*t2;
			tpos = self.tpropcache[index]; //((float)t/T);
            
			//linear interpolation of amplitude
            amp = amp1 + (tpos*(amp2- amp1));
			//printf("amp %f temp3 %f amp2 %f number %f \n",amp,temp3, tracks[i].amp2, ((float)t/T));
            
			//cubic interpolation of phase; probably self is the chief cause of inefficiency...
			phase = (theta1) + (t*omega1)+(t2*alpha) +(t3*beta);
            
            //0.1591549430919 = reciptwopi
			phasetemp = phase*0.1591549430919*self.g_costableTPVsize;
            
			//linear interpolation into costable
			//could use fmod if add very big multiple of pi so modulo works properly; ie, no negative phases allowed BUT fmod is really inefficient!
			//float wrapval= sc_wrap(phasetemp,0.0f,1024.0f); //modulo or fold won't work correctly- i.e., we need -1 = 1023
            
            //to cope with negatives
            //https://stackoverflow.com/questions/16964225/keep-an-index-within-bounds-and-wrap-around
            wrapval = (phasetemp%1024 + 1024)%1024; //(x%m + m)%m
            
			prev = Math.floor(wrapval);
			prop =  wrapval-prev; //linear interpolation parameter
			interp = ((1.0-prop)*(self.g_costableTPV[prev])) + (prop*(self.g_costableTPV[prev+1]));
       
			out[j] += amp*interp; //g_costableTPV[((int)(phasetemp))%g_costableTPVsize];
		}
        
	}
    
    
	self.m_resynthesisposition += numSamples;


}

    
}

