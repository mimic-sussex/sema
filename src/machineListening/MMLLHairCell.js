//Nick Collins 22/06/18 adapted from HairCell SC UGen in sc3-plugins


function MMLLHairCell(samplingrate=44100) {
    
    var self = this;
    
    self.samplingrate = samplingrate
    
    self.dt = 1.0/self.samplingrate;
    //gain=0.5;
    self.loss=0.99;
    //loss2=0.9;
    
    self.store = 1.0;
    self.minflow = 0.0; //(1.0/0.01)*dt;	//no spontaneous firing
    self.restoreflow = (1.0/0.001)*self.dt;
    self.feedflow = (self.restoreflow-self.minflow)*2.8284271247462; //2 times root 2, because rectification means effective only half a cycle, and RMS of 1/root2 must be compensated for
    
    //firingdelay= (int) (samplingrate*0.01); //(int) (samplingrate*0.001);
    //countsincelastfired=1;
    
    self.level = 0.0;
    self.outputlevel = 0.0;
    
    
    self.updateminflow = function(minflow=0) {
        if(minflow<0) minflow = 0;
		if(minflow>20000) minflow = 20000;
		
        self.minflow = self.dt*2.8284271247462*minflow; //compensation for half cycle and RMS
    }
    
    self.updatefeedflow = function(feedflow=200) {
        if(feedflow<0) feedflow = 0;
		if(feedflow>20000) feedflow = 20000;
		
        self.feedflow = self.dt*2.8284271247462*feedflow;
    }
    
    self.updaterestoreflow = function(restoreflow=1000) {
        if(restoreflow<0) restoreflow = 0;
		if(restoreflow>20000) restoreflow = 20000;
		
        self.restoreflow = self.dt*restoreflow;
    }
    
    self.updateloss = function(loss=0) {
        if(loss<0) loss = 0;
		if(loss>1) loss = 1;
		
        self.loss = loss;
    }
    
    self.update = function(minflow=0,feedflow=200,restoreflow=1000,loss=0.99) {
		
        self.updateminflow(minflow);
        self.updatefeedflow(feedflow);
        self.updaterestoreflow(restoreflow);
        self.updateloss(loss);
 
    }
    
    self.next = function(input,output,numSamples) {
        
        var i;
        var latest;
        var newflow;
        
        for (i=0; i<numSamples; ++i) {
            
            latest = input[i];
            
            //halfwave rectification and potential nonlinearity
            if(latest<0.0) latest=0.0;
            //else latest= latest; //sqrt(latest); //*latest; //or square root, or whatever
            
            newflow = self.minflow+(self.feedflow*latest);
            
            if(newflow>self.store) newflow = self.store;
            
            //if enough transmitter available
            self.store -= newflow;
            
            if(self.store<0.0) self.store = 0.0;
            
            self.level += newflow;
            
            if(self.level>1.0){
                
                //assuming 100 Hz resting rate
                self.outputlevel = 1.0; //could make peak dependent on how long it took it get there
                
                self.level = 0.0; //hair cell wiped out
                
            }
            
            self.store += self.restoreflow;
            
            output[i] = self.outputlevel;
            
            self.outputlevel *= self.loss;
            
        }
        
        
    }
    
}





