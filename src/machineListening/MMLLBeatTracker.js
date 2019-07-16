//Nick Collins audio beat tracking algorithm adapted from my SuperCollider BeatTrack code, itself derived from Matthew Davies beat tracker research


function MMLLBeatTracker(sampleRate) {

    var self = this; 
    
    self.fftsize = 1024;
    
    var beatTrackModule = BeatTrackModule({});

    self.beattrackfunction = beatTrackModule.cwrap('BeatTrack_next',
                                         'number', // Function return void
                                         // Integers, Floating point numbers and pointers all
                                         // are considered 'number'
                                         ['number','number']
                                         );
    
    self.destructorfunction = beatTrackModule.cwrap('BeatTrack_Dtor',
                                          null, // Function return void
                                          [] //no arguments
                                          );
    
    
    //BeatTrack_samplestonextbeat
    self.samplestonextbeat = beatTrackModule.cwrap('BeatTrack_samplestonextbeat',
                                       'number', // Function return void
                                       [] //no arguments
                                       );
    
    self.tempo = beatTrackModule.cwrap('BeatTrack_tempo',
                                                    'number', // Function return void
                                                    [] //no arguments
                                                    );
    self.phase = beatTrackModule.cwrap('BeatTrack_phase',
                                       'number', // Function return void
                                       [] //no arguments
                                       );
    
    // Allocate array memory (sizeof double = 8) and
    // get a pointer to it
    self.parr = beatTrackModule._malloc(self.fftsize*8);
    
    // Populate the array
    // We create Float64Array in javascript code and map it to
    // the pointer that we received above. We can then populate
    // the array with values we want to pass as input
    self.arr = new Float64Array(beatTrackModule.HEAPF64.buffer, self.parr, self.fftsize);

    //to hold interleaved real and imag fft calculation results
    self.fftoutput = new Float64Array(self.fftsize);
    
    
    //if sample rate is 88200 or 96000, assume taking double size FFT to start with
	if(self.m_srate >= (44100*2)) {
        
        //presume double size function withfft(powers){}
        self.stft = new MMLLSTFT(self.fftsize * 2,self.fftsize,0);
        
        self.m_srate = self.m_srate/2;
    } else {
        
        self.stft = new MMLLSTFT(self.fftsize,self.fftsize /2 ,0); //0 = rectangular (no) window
        
    }
    
    beatTrackModule.ccall('BeatTrack_Ctor',
                 null, // Function return void
                 // Integers, Floating point numbers and pointers all
                 // are considered 'number'
                 ['number','number'],
                 [sampleRate,self.fftsize / 2]
                 );

 
//must pass in fft data (not power spectrum, need actual fft bins here)
self.next = function(input,audioblocksize) {

    var i,j;
 
    var ready = self.stft.next(input);
    
    var beat = 0;
    
    if(ready) {
       
        var fftdata = self.stft.complex;

        var fftoutput = self.fftoutput;
        
        //power spectrum not amps, for QMUL complex onset detection algorithm
        for (var k = 0; k < self.fftsize / 2; ++k) {

            var index = 2*k;
            
            fftoutput[index] = fftdata[index];
            fftoutput[index+1] = fftdata[index+1];
            
        }

        self.arr.set(fftoutput);
        
    //self.arr.set(self.stft.output); //can't go direct, output size is 1026 and target needs 1024
    
        //n, fftdata first argument not really used
    beat = self.beattrackfunction(self.fftsize,self.parr);
        
    }
    
    return beat;
    
  }


}


