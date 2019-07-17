//Nick Collins 22/06/18 adapted from SC UGen in sc3-plugins
//based on V Hohmann Frequency analysis and synthesis using a Gammatone filterbank Acta Acustica vol 88 (2002): 433--442
//converted to straight struct form for SuperCollider from my own GammatoneComplexBandpass class code

function MMLLGammatone(samplingrate=44100) {
    
    var self = this; 
    //double precision where possible, use Float64

    self.samplingrate = samplingrate
    self.samplingperiod = 1.0/samplingrate;
	self.nyquist = samplingrate*0.5;
	
 
self.setup = function(centrefrequency,bandwidth) {
	var i,j;
    
	if (centrefrequency< 20.0) centrefrequency = 20.0;
	if (centrefrequency>self.nyquist) centrefrequency = self.nyquist;
	
	if ((centrefrequency-(0.5*bandwidth))<1.0) bandwidth = 2.0*(centrefrequency-1.0);

	if (bandwidth>self.nyquist) bandwidth = self.nyquist; //assuming there is even room!
 
	self.centrefrequency = centrefrequency;
	
	//actually need to convert ERBs to 3dB bandwidth
	bandwidth = 0.887*bandwidth; //converting to 3dB bandwith in Hz, 	//PH96 pg 3
	
	self.bandwidth = bandwidth;
	
	// filter coefficients to calculate, p.435 hohmann paper
	
	var beta = 6.2831853071796*self.centrefrequency*self.samplingperiod;
	var phi = 3.1415926535898*self.bandwidth*self.samplingperiod;
	var p =  (1.6827902832904*Math.cos(phi) -2)*6.3049771007832;
	var lambda = (p*(-0.5))-(Math.sqrt(p*p*0.25-1.0));
	
	self.reala = lambda*Math.cos(beta);
	self.imaga = lambda*Math.sin(beta);
	
	//avoid b= 0 or Nyquist, otherise must remove factor of 2.0 here
	self.normalisation= 2.0*(Math.pow(1-Math.abs(lambda),4));
	
	self.oldreal = [0,0,0,0]; //[4];
	self.oldimag = [0,0,0,0]; //[4];

}




    
//adapting zapgremlins from SC_InlineUnaryOp.h for denormal prevention
//see also similar algorithm in https://www.boost.org/doc/libs/1_51_0/boost/math/special_functions/fpclassify.hpp (used by CheckBadValues in SC)
self.next = function(input,output,numSamples) {

    var i,j;
    
    var newreal, newimag;
	
	var reala = self.reala;
	var imaga = self.imaga;
	var normalisation = self.normalisation;
	
    var absx;
    
	for (i=0; i<numSamples; ++i) {
		
		newreal = input[i]; //real input
		newimag = 0.0;
		
		for (j=0; j<4; ++j) {
			
			newreal = newreal + (reala*self.oldreal[j])-(imaga*self.oldimag[j]);
			newimag = newimag + (reala*self.oldimag[j])+(imaga*self.oldreal[j]);
			
			self.oldreal[j] = newreal; //zapgremlins(newreal); //trying to avoid denormals which mess up processing via underflow
			self.oldimag[j] = newimag; //zapgremlins(newimag);
            
            absx = Math.abs(newreal);
            
            //return (absx > (float32)1e-15 && absx < (float32)1e15) ? x : (float32)0.;
            self.oldreal[j] = (absx > 1e-15 && absx < 1e15) ? newreal : 0.;
            
            absx = Math.abs(newimag);
            
            self.oldimag[j] = (absx > 1e-15 && absx < 1e15) ? newimag : 0.;
            
            
		}
		
		output[i] = newreal*normalisation;
		
		//imaginary output too could be useful
		
	}

    
}

}





