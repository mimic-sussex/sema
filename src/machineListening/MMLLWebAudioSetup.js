//put all the awkward Web Audio API setup code here



function MMLLWebAudioSetup(blocksize, inputtype, callback, setup) {
 
    var self = this;
    
    self.audioblocksize = blocksize;
    self.inputtype = inputtype;
    self.inputAudio = new MMLLInputAudio(self.audioblocksize);
    self.outputAudio = new MMLLOutputAudio(self.audioblocksize); //always stereo for now
    
    self.callback = callback;
    self.setup = setup;
    
    self.sampleRate = 0;
    self.audiocontext = 0;
    self.node = 0;
    self.numInputChannels = 1;
    //self.audionotrunning = 1;
    self.audiorunning = false;
    
    self.usingMicrophone = function() {
        
        return ((self.inputtype == 1) || (self.inputtype == 2));
    }
    
    
    self.initAudio = function(inputstream) {
        
        console.log('initialising audio'); //debug console message
        
        //delete previous if necessary
        if (self.audiorunning) {
            
            self.audiocontext.close(); //let previous go
        }
        
        //can request specific sample rate, but leaving as device's default for now
        //https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
        try {
            self.audiocontext = new webkitAudioContext();
            
        } catch (e) {
            
            try {
                
                self.audiocontext = new AudioContext();
                
            } catch(e) {
                
                alert("Your browser does not support Web Audio API!");
                return;
            }
            
        }
        
        self.sampleRate = self.audiocontext.sampleRate; //usually 44100.0
        
        console.log("AudioContext established with sample rate:",self.sampleRate," and now setting up for input type:",self.inputtype); //print
        
        self.setup(self.sampleRate);
        
        if((self.inputtype == 1) || (self.inputtype == 2)) {
            
            var audioinput = self.audiocontext.createMediaStreamSource(inputstream);
            
            self.numInputChannels = self.inputtype; //1 or 2 inputs
            
            self.inputAudio.numChannels = self.numInputChannels;
            
            self.node = self.audiocontext.createScriptProcessor(self.audioblocksize,self.numInputChannels,2); //1 or 2 inputs, 2 outputs
            
            audioinput.connect(self.node);
            
            self.node.onaudioprocess = self.process;  //this is nil since this isn't what you think it is here
            
            self.node.connect(self.audiocontext.destination);
            
        } else {
            
            
            if(self.inputtype == 0) {
             
                //no input
                
                self.node = self.audiocontext.createScriptProcessor(self.audioblocksize,0,2); //0 input, 2 outputs
                self.node.onaudioprocess = self.synthesizeAudio;
                
                //direct synthesis
                self.node.connect(self.audiocontext.destination);
                
            
            } else {
            
            //            self.node = self.audiocontext.createScriptProcessor(self.audioblocksize,0,2); //0 input, 2 outputs
            //
            //            self.node.onaudioprocess = self.processSoundFile;
            //
            self.initSoundFileRead(self.inputtype);
                
            }
            
        }
        
        self.audiorunning = true;
        //self.audionotrunning = 0;
        
    };
    
    self.initSoundFileRead = function(filename) {
        
        self.sampler = new MMLLSampler();
        self.sampleplayer;
        //was Float64Array
        //self.samplearray = new Float32Array(audioblocksize);
        
        //"/sounds/05_radiohead_killer_cars.wav"
        self.sampler.loadSamples([filename],
                            function onload() {
                            
                            self.sampleplayer = new MMLLSamplePlayer();
                            self.sampleplayer.reset(self.sampler.buffers[0]);
                            //self.sampleplayer.numChannels = self.sampler.buffers[0]
                            
                            if(self.sampleplayer.numChannels>1) {
                            //interleaved input
                            self.numInputChannels = 2;
                            
                            self.inputAudio.numChannels = self.numInputChannels;
                            //self.samplearray = new Float32Array(2*audioblocksize);
                            
                            }
                            
                            //samplearray depends on number of Channels whether interleaved
                            
                            // This AudioNode will create the samples directly in JavaScript
                            //proceed with hop size worth of samples
                            self.node = self.audiocontext.createScriptProcessor(self.audioblocksize,0,2); //0 input, 2 outputs
                            self.node.onaudioprocess = self.processSoundFile;
                            
                            //direct synthesis
                            self.node.connect(self.audiocontext.destination);
                            
                            
                            },self.audiocontext);
        
    };
    
    self.synthesizeAudio = function(event) {
       
        // Get output arrays
        var outputArrayL = event.outputBuffer.getChannelData(0);
        var outputArrayR = event.outputBuffer.getChannelData(1);
        
        //number of samples to calculate is based on (common) length of these buffers
        var n = outputArrayL.length;
        
        var i;
        
        //safety, zero out output if accumulating to it
        for (var i = 0; i < n; ++i) outputArrayL[i] = outputArrayR[i] = 0.0;
        
        self.outputAudio.outputL = outputArrayL;
        self.outputAudio.outputR = outputArrayR;
        
        //no input argument, just synthesise output entirely
        self.callback(self.outputAudio,n);
        
    };
    
    
    
    self.processSoundFile = function(event) {
        // Get output arrays
        var outputArrayL = event.outputBuffer.getChannelData(0);
        var outputArrayR = event.outputBuffer.getChannelData(1);
        //var input = event.inputBuffer.getChannelData(0);

        //number of samples to calculate is based on (common) length of these buffers
        var n = outputArrayL.length; //outputArrayL.length;
        
        var i;
        //console.log("processSoundFile",event,n);
        
//        if(self.numInputChannels==2) {
//           
//            
//            
//            
//            for (i = 0; i< 2*n; ++i)
//                self.samplearray[i] = 0.0;
//            
//           
//        } else {
//        
//        //listening
//        for (i = 0; i< n; ++i)
//            self.samplearray[i] = 0.0;
//        
//        }
        
        //safety, zero out input if accumulating to it
        
        for (var i = 0; i < n; ++i) self.inputAudio.monoinput[i] = self.inputAudio.inputL[i] = self.inputAudio.inputR[i] = 0.0;
        
        
        //self.sampleplayer.render(self.samplearray,n);
        self.sampleplayer.render(self.inputAudio,n);
   
       
        //safety, zero out output if accumulating to it
        for (var i = 0; i < n; ++i) outputArrayL[i] = outputArrayR[i] = 0.0;
        
        self.outputAudio.outputL = outputArrayL;
        self.outputAudio.outputR = outputArrayR;
        
       
        
        
        //self.callback(inputL,outputArrayL,outputArrayR,n);
        self.callback(self.inputAudio,self.outputAudio,n);
        
        
        //self.callback(self.samplearray,outputArrayL,outputArrayR,n);
        
    };
    
    self.process = function(event) {
        // Get output arrays
        var outputArrayL = event.outputBuffer.getChannelData(0);
        var outputArrayR = event.outputBuffer.getChannelData(1);
        var inputL = event.inputBuffer.getChannelData(0);
       
        
        //number of samples to calculate is based on (common) length of these buffers
        var n = inputL.length; //outputArrayL.length;

        //console.log("process",event,n);
        
        //denormal safety checks on input
        
        for (var i = 0; i < n; ++i) {
            
            inputnow = inputL[i];
            
            //clip input deliberately to avoid blowing filters later
            if(inputnow>1.0) inputnow = 1.0;
            if(inputnow<-1.0) inputnow = -1.0;
            
            //subnormal floating point protection on input
            absx = Math.abs(inputnow);
            inputL[i] = (absx > 1e-15 && absx < 1e15) ? inputnow : 0.;
            
        }
        
        if(self.numInputChannels == 2) {
            var inputR = event.inputBuffer.getChannelData(1);
            
            
            for (var i = 0; i < n; ++i) {
                
                inputnow = inputR[i];
                
                //clip input deliberately to avoid blowing filters later
                if(inputnow>1.0) inputnow = 1.0;
                if(inputnow<-1.0) inputnow = -1.0;
                
                //subnormal floating point protection on input
                absx = Math.abs(inputnow);
                inputR[i] = (absx > 1e-15 && absx < 1e15) ? inputnow : 0.;
                
            }

            var left, right;
            var monoinput = self.inputAudio.monoinput;

            for (var i = 0; i < n; ++i) {
                
                left = inputL[i];
                right = inputR[i];
                monoinput[i] = (left+right)*0.5;
                
            }
            
            self.inputAudio.inputL = inputL;
            self.inputAudio.inputR = inputR;
            
            
        } else {
            
            self.inputAudio.monoinput = inputL;
            self.inputAudio.inputL = inputL;
            self.inputAudio.inputR = inputL;
            
//            left = self.inputAudio.inputL;
//            right = self.inputAudio.inputR;
//            
//            for (var i = 0; i < n; ++i) {
//                
//                left[i] = inputL[i];
//                right[i] = inputL[i];
//                
//            }
            
            
        }
        
        //safety, zero out output if accumulating to it
        for (var i = 0; i < n; ++i) outputArrayL[i] = outputArrayR[i] = 0.0;
        
        self.outputAudio.outputL = outputArrayL;
        self.outputAudio.outputR = outputArrayR;
        
        //self.callback(inputL,outputArrayL,outputArrayR,n);
        self.callback(self.inputAudio,self.outputAudio,n);
        
    };
    
    //if(self.audionotrunning) {
        
        console.log('init MMLLWebAudioSetup');
        
        //microphone input
        if(inputtype == 1 || inputtype == 2) {
            
            //navigator.mediaDevices.getUserMedia
            //https://stackoverflow.com/questions/37673000/typeerror-getusermedia-called-on-an-object-that-does-not-implement-interface
            
            if (!navigator.getUserMedia)
                navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                 navigator.mozGetUserMedia || navigator.msGetUserMedia;
            
            navigator.getUserMedia({audio:true}, self.initAudio, function(e) {
                                   alert('Error getting audio');
                                   console.log(e);
                                   });
            
            
        } else {
            
            self.initAudio();
            
        }
        
        
    //};
    
}

