//Nick Collins first created 8th June 2018

//support mono and stereo
//asynchronous loading, with function to call upon completion passed in

//shared between Sampler and MMLLWebAudioSetup
function MMLLInputAudio(blocksize)
{
    var self = this;
    
	self.monoinput = new Float32Array(blocksize);
	self.inputL = new Float32Array(blocksize);
	self.inputR = new Float32Array(blocksize);
    self.numChannels = 1;
}
function MMLLOutputAudio(blocksize)
{
    var self = this;
    
	self.outputL = new Float32Array(blocksize);
	self.ouputR = new Float32Array(blocksize);
}


//no longer uses interleaved audio if multiple channels
function MMLLBuffer() {
    
    var self = this;
    
    self.dataL = 0;
    self.dataR = 0;
    self.length = 0;
    self.duration = 0;
    self.sampleRate = 44100.0;
    self.numChannels = 1; //unless otherwise

    
}


//contains state for block by block playback of a mono OR stereo buffer object
function MMLLSamplePlayer() {
    
    var self = this;
    
    self.buffer = 0;
    self.playbackposition = 0;
    self.lengthinsampleframes = 0;
    self.numChannels  = 1;
    self.playing = 0;
    self.offset = 0;
    
    //mix settings for pan and amplitude come later? //to a stereo output bus
    //self.amp = 0.4;
    //self.pan = 0.0;
 
    
    self.reset = function(buffer) {
        
        if(buffer!= null) {
            self.buffer = buffer;
            
            self.lengthinsampleframes = buffer.length;
            
            self.numChannels = buffer.numChannels;
        }
        
        self.playbackposition = 0;
        self.playing = 1;
        
    }
    
    //offset code should abstract out to superclass Player
    
    
    //CHECK FOR STEREO COMPATIBILITY
    
    //arrayL, arrayR not stereo rendering
    self.render = function(inputaudio, numSamples) {
        
        var i;
        
        var samplesleft = self.lengthinsampleframes - self.playbackposition; //self.buffer.length;
        
        var datasource,datasource2; // = self.buffer.data;
        
        var offset = self.offset;
        
        var baseindex, sourceinde
        
        //must make copy else changing original reference and messing up rendering for other active events?
        //actually, probably OK, but will keep self way while debugging an issue right now
        var numsamplesnow = numSamples;
        
        numsamplesnow -= offset;
        
        var samplestodo = numsamplesnow;

        if(numsamplesnow>samplesleft) {
            samplestodo = samplesleft;
             self.playing = 0;
        }
        
        var pos = self.playbackposition;
        
        var outputL = inputaudio.inputL;
        var outputR = inputaudio.inputR;
        var monooutput = inputaudio.monoinput;
        
        
        var temp;
        if(offset>0) {
            
            if(self.numChannels ==1) {
            
                datasource = self.buffer.dataL;
                
            for (i = 0; i < samplestodo; ++i) {
                
                temp = datasource[pos+i];
                outputL[offset+i] += temp; //pos will be zero here since only use offset on first block, however keep code as is in case later have playback of sample starting in middle etc
                
                outputR[offset+i] += temp;
                
                monooutput[offset+i] = temp;
            }
                
            } else {
                
                datasource = self.buffer.dataL;
                datasource2 = self.buffer.dataR;
                
                for (i = 0; i < samplestodo; ++i) {
                    temp = offset+i;
                    outputL[temp] += datasource[pos+i];
                    outputR[temp] += datasource2[pos+i];
                    
                    monooutput[offset+i] = (outputL[temp] + outputR[temp])*0.5;
                }
                
//                for (i = 0; i < samplestodo; ++i) {
//                    baseindex = 2*(offset+i);
//                    sourceindex = 2*(pos+i);
//                    
//                    array[baseindex] += datasource[sourceindex];
//                    array[baseindex+1] += datasource[sourceindex+1];
//                    
//                    
//                    //pos will be zero here since only use offset on first block, however keep code as is in case later have playback of sample starting in middle etc
//                }
                
            }
            
            //only active in first block rendered
            self.offset = 0;
            
        } else
        {
            
            if(self.numChannels ==1) {
                
                datasource = self.buffer.dataL;
                
               
                for (i = 0; i < samplestodo; ++i) {
                    
                    temp = datasource[pos+i];
                    
                    outputL[i] += temp; //pos will be zero here since only use offset on first block, however keep code as is in case later have playback of sample starting in middle etc
                    
                    outputR[i] += temp;
                    
                    monooutput[i] +=temp;
                }
                
                
                
//            for (i = 0; i < samplestodo; ++i) {
//                array[i] += datasource[pos+i];
//            }
                
            } else {
                
                datasource = self.buffer.dataL;
                datasource2 = self.buffer.dataR;
                
                for (i = 0; i < samplestodo; ++i) {
                    outputL[i] += datasource[pos+i];
                    outputR[i] += datasource2[pos+i];
                    
                    monooutput[i] = (outputL[i] + outputR[i]) * 0.5; 
                }
                
//                for (i = 0; i < samplestodo; ++i) {
//                    baseindex = 2*i;
//                    sourceindex = 2*(pos+i);
//                    
//                    array[baseindex] += datasource[sourceindex];
//                    array[baseindex+1] += datasource[sourceindex+1];
//                
//                }
                
            }
            
            
            
        }
        
        self.playbackposition += samplestodo;
        
       
        
    }
    
    
    
}



function MMLLSampler() {
    
    //https://stackoverflow.com/questions/20279484/how-to-access-the-correct-this-inside-a-callback
    var self = this;
    
    self.loadcounter = 0;
    self.buffers = 0;
    
    self.loadSamples = function(arrayofpaths, onloadfunction, audiocontext) {
        
        self.numbuffers = arrayofpaths.length;
        
        self.buffers = new Array(self.numbuffers);
        
        for(var i=0; i<arrayofpaths.length; ++i) {
            
            var nowtoload = arrayofpaths[i];
            
            console.log(typeof(nowtoload),nowtoload);
            
            if(typeof(nowtoload)==='string') {
            
            self.loadSample(nowtoload,onloadfunction,i,audiocontext);
                
            } else {
                
            self.loadSample2(nowtoload,onloadfunction,i,audiocontext);
                
            }
            
        }
        
    }
    
    
    
 
    
    self.loadSample2 = function(fileobject,onloadfunction,index,audiocontext) {
     
        
        //http://composerprogrammer.com/music/demo1.mp3
        
        
        var reader = new FileReader();
        
        reader.onload = function(e) {
            
            var audioData = reader.result;
            audiocontext.decodeAudioData(audioData, function(buf) {
                                         //assume only playback one channel, raw format probably interleaved sample frames
                                         
                                         var buffernow = new MMLLBuffer();
                                         
                                         //can get interleaved? Or should already split?
                                         //for machine listening will want in mono
                                         
                                         
                                         buffernow.numChannels = buf.numberOfChannels;
                                         
                                         //at most STEREO
                                         if(buffernow.numChannels>2) buffernow.numChannels = 2;
                                         
                                         buffernow.length = buf.length;
                                         buffernow.duration = buf.duration;
                                         buffernow.sampleRate = buf.sampleRate;
                                         
                                         if(buffernow.numChannels==1) {
                                         
                                         buffernow.dataL = buf.getChannelData(0); //assuming mono
                                         //https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
                                         
                                         } else {
                                         
                                         //assumes 2 channels
                                         //get stereo arrays then interleave into one
                                         
                                         buffernow.dataL = buf.getChannelData(0);
                                         buffernow.dataR = buf.getChannelData(1);
                                         
//                                         var channelL = buf.getChannelData(0);
//                                         var channelR = buf.getChannelData(1);
//                                         
//                                         buffernow.data = new Array(buffernow.length*2);
//                                         
//                                         var where;
//                                         
//                                         for(var k = 0; k<buffernow.length; ++k) {
//                                         
//                                         where = 2*k;
//                                         
//                                         buffernow.data[where] = channelL[k];
//                                         buffernow.data[where+1] = channelR[k];
//                                         
                                         
                                         //}
                                         
                                         
                                         }
                                         
                                       
                                         //console.log('buffer loaded test 1',self,self,self.loadcounter,filename,buf.length,buf.duration, buf.sampleRate); //print
                                         
                                         
                                         //console.log('buffer loaded test 2',self.loadcounter,filename,buffernow.length,buffernow.sampleRate,self.buffers); //print
                                         
                                         self.buffers[index] = buffernow;
                                         
                                         //console.log('buffer loaded',self.loadcounter,filename,buffernow.length,buffernow.samplerate); //print
                                         
                                         
                                         ++(self.loadcounter);
                                         
                                         if(self.loadcounter==self.numbuffers) {
                                         
                                         onloadfunction();
                                         }
                                         
                                         
                                         },
                                         function(e){"Error with decoding audio data" + e.err});
        }
        
        reader.readAsArrayBuffer(fileobject);
        
        
        
    }
    
    
    self.loadSample = function(filename,onloadfunction,index,audiocontext) {
        
        var request = new XMLHttpRequest();
 
        //var filename = "loop"+which+".wav";
        
        
        //http://composerprogrammer.com/music/demo1.mp3
        request.open('GET', filename, true); //viper.ogg
        request.responseType = 'arraybuffer';
     
        
        request.onload = function() {
            var audioData = request.response;
            audiocontext.decodeAudioData(audioData, function(buf) {
                                         //assume only playback one channel, raw format probably interleaved sample frames
                                         
                                         var buffernow = new MMLLBuffer();
                                         
                                         
                                         
                                         
                                         
                                         buffernow.numChannels = buf.numberOfChannels;
                                         
                                         //at most STEREO
                                         if(buffernow.numChannels>2) buffernow.numChannels = 2;
                                         
                                         buffernow.length = buf.length;
                                         buffernow.duration = buf.duration;
                                         buffernow.sampleRate = buf.sampleRate;
                                         
                                         if(buffernow.numChannels==1) {
                                         
                                         buffernow.dataL = buf.getChannelData(0); //assuming mono
                                         //https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
                                         
                                         } else {
                                         
                                         //assumes 2 channels
                                         //get stereo arrays then interleave into one
                                         buffernow.dataL = buf.getChannelData(0);
                                         buffernow.dataR = buf.getChannelData(1);
                                         
//                                         var channelL = buf.getChannelData(0);
//                                         var channelR = buf.getChannelData(1);
//                                         
//                                         buffernow.data = new Array(buffernow.length*2);
//                                         
//                                         var where;
//                                         
//                                         for(var k = 0; k<buffernow.length; ++k) {
//                                         
//                                         where = 2*k;
//                                         
//                                         buffernow.data[where] = channelL[k];
//                                         buffernow.data[where+1] = channelR[k];
//                                         
//                                         
//                                         }
                                         
                                         
                                         }
                                         
                                         
                                         
//                                         buffernow.data = buf.getChannelData(0); //left only, o/w assuming mono
//                                         //https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
//                                         buffernow.length = buf.length;
//                                         buffernow.duration = buf.duration;
//                                         buffernow.sampleRate = buf.sampleRate;
//                                         
//                                          //console.log('buffer loaded test 1',self,self,self.loadcounter,filename,buf.length,buf.duration, buf.sampleRate); //print
                                         
                                         
                                         //console.log('buffer loaded test 2',self.loadcounter,filename,buffernow.length,buffernow.sampleRate,self.buffers); //print
                                         
                                         self.buffers[index] = buffernow;
                                         
                                         //console.log('buffer loaded',self.loadcounter,filename,buffernow.length,buffernow.samplerate); //print
                                         
                                         
                                         ++(self.loadcounter);
                                         
                                         if(self.loadcounter==self.numbuffers) {
                                         
                                            onloadfunction();
                                         }
                                         
                                         
                                         },
                                         function(e){"Error with decoding audio data" + e.err});
        }
        request.send();
        
        
        
    }
    

    
}

