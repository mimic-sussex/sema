//onset detection function as used in MMLLOnsetDetector
//assumes sampling rate 44.1kHz


function MMLLBeatTrackerFastReact(sampleRate,threshold=0.34) {
    
    var self = this; 
    
    //helpful constants

    //assumes fixed sampling rate
    //FFT data
    self.N = 1024
    self.NOVER2 = 512

    self.NUMERBBANDS = 40;
    self.PASTERBBANDS = 3;
    //3 usually, but time resolution improved if made 1?
    
    //in FFT frames
    //self.MAXEVENTDUR 80;
    self.MINEVENTDUR = 3;
    //4 or maybe 2
    
    //7 frames is about 40 mS
    //peak picker will use 3 back, 3 forward
    self.DFFRAMESSTORED = 7;

	//loudness measure
	self.m_loudbands = new Array(self.NUMERBBANDS); //[NUMERBBANDS][PASTERBBANDS]; //stores previous loudness bands
	//var m_pasterbbandcounter;
    self.m_df = new Float64Array(self.DFFRAMESSTORED);
	//self.m_dfcounter;
	
	//recording state
	//self.m_onsetdetected;

//[43]
self.eqlbandbins = [1,2,3,4,5,6,7,8,9,11,13,15,17,19,22,25,28,32,36,41,46,52,58,65,73,82,92,103,116,129,144,161,180,201,225,251,280,312,348,388,433,483,513];
//[42]
    //last entry was 30, corrected to 29 to avoid grabbing nyquist value, only half fftsize bins actually calculated for power
    //safe anyway since only 40 ERB bands used
self.eqlbandsizes = [1,1,1,1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,5,5,6,6,7,8,9,10,11,13,13,15,17,19,21,24,26,29,32,36,40,45,50,29];

//[42][11]
self.contours = [[ 47.88, 59.68, 68.55, 75.48, 81.71, 87.54, 93.24, 98.84,104.44,109.94,115.31],[ 29.04, 41.78, 51.98, 60.18, 67.51, 74.54, 81.34, 87.97, 94.61,101.21,107.74],[ 20.72, 32.83, 43.44, 52.18, 60.24, 67.89, 75.34, 82.70, 89.97, 97.23,104.49],[ 15.87, 27.14, 37.84, 46.94, 55.44, 63.57, 71.51, 79.34, 87.14, 94.97,102.37],[ 12.64, 23.24, 33.91, 43.27, 52.07, 60.57, 68.87, 77.10, 85.24, 93.44,100.90],[ 10.31, 20.43, 31.03, 40.54, 49.59, 58.33, 66.89, 75.43, 83.89, 92.34,100.80],[  8.51, 18.23, 28.83, 38.41, 47.65, 56.59, 65.42, 74.16, 82.89, 91.61,100.33],[  7.14, 16.55, 27.11, 36.79, 46.16, 55.27, 64.29, 73.24, 82.15, 91.06, 99.97],[  5.52, 14.58, 25.07, 34.88, 44.40, 53.73, 62.95, 72.18, 81.31, 90.44, 99.57],[  3.98, 12.69, 23.10, 32.99, 42.69, 52.27, 61.66, 71.15, 80.54, 89.93, 99.31],[  2.99, 11.43, 21.76, 31.73, 41.49, 51.22, 60.88, 70.51, 80.11, 89.70, 99.30],[  2.35, 10.58, 20.83, 30.86, 40.68, 50.51, 60.33, 70.08, 79.83, 89.58, 99.32],[  2.05, 10.12, 20.27, 30.35, 40.22, 50.10, 59.97, 69.82, 79.67, 89.52, 99.38],[  2.00,  9.93, 20.00, 30.07, 40.00, 49.93, 59.87, 69.80, 79.73, 89.67, 99.60],[  2.19, 10.00, 20.00, 30.00, 40.00, 50.00, 59.99, 69.99, 79.98, 89.98, 99.97],[  2.71, 10.56, 20.61, 30.71, 40.76, 50.81, 60.86, 70.96, 81.01, 91.06,101.17],[  3.11, 11.05, 21.19, 31.41, 41.53, 51.64, 61.75, 71.95, 82.05, 92.15,102.33],[  2.39, 10.69, 21.14, 31.52, 41.73, 51.95, 62.11, 72.31, 82.46, 92.56,102.59],[  1.50, 10.11, 20.82, 31.32, 41.62, 51.92, 62.12, 72.32, 82.52, 92.63,102.56],[ -0.17,  8.50, 19.27, 29.77, 40.07, 50.37, 60.57, 70.77, 80.97, 91.13,101.23],[ -1.80,  6.96, 17.77, 28.29, 38.61, 48.91, 59.13, 69.33, 79.53, 89.71, 99.86],[ -3.42,  5.49, 16.36, 26.94, 37.31, 47.61, 57.88, 68.08, 78.28, 88.41, 98.39],[ -4.73,  4.38, 15.34, 25.99, 36.39, 46.71, 57.01, 67.21, 77.41, 87.51, 97.41],[ -5.73,  3.63, 14.74, 25.48, 35.88, 46.26, 56.56, 66.76, 76.96, 87.06, 96.96],[ -6.24,  3.33, 14.59, 25.39, 35.84, 46.22, 56.52, 66.72, 76.92, 87.04, 97.00],[ -6.09,  3.62, 15.03, 25.83, 36.37, 46.70, 57.00, 67.20, 77.40, 87.57, 97.68],[ -5.32,  4.44, 15.90, 26.70, 37.28, 47.60, 57.90, 68.10, 78.30, 88.52, 98.78],[ -3.49,  6.17, 17.52, 28.32, 38.85, 49.22, 59.52, 69.72, 79.92, 90.20,100.61],[ -0.81,  8.58, 19.73, 30.44, 40.90, 51.24, 61.52, 71.69, 81.87, 92.15,102.63],[  2.91, 11.82, 22.64, 33.17, 43.53, 53.73, 63.96, 74.09, 84.22, 94.45,104.89],[  6.68, 15.19, 25.71, 36.03, 46.25, 56.31, 66.45, 76.49, 86.54, 96.72,107.15],[ 10.43, 18.65, 28.94, 39.02, 49.01, 58.98, 68.93, 78.78, 88.69, 98.83,109.36],[ 13.56, 21.65, 31.78, 41.68, 51.45, 61.31, 71.07, 80.73, 90.48,100.51,111.01],[ 14.36, 22.91, 33.19, 43.09, 52.71, 62.37, 71.92, 81.38, 90.88,100.56,110.56],[ 15.06, 23.90, 34.23, 44.05, 53.48, 62.90, 72.21, 81.43, 90.65, 99.93,109.34],[ 15.36, 23.90, 33.89, 43.31, 52.40, 61.42, 70.29, 79.18, 88.00, 96.69,105.17],[ 15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00,101.70],[ 15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00,101.70],[ 15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00,101.70],[ 15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00,101.70],[ 15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00,101.70],[ 15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00,101.70]];
//[11]
self.phons = [2,10,20,30,40,50,60,70,80,90,100];

//empirically determined default value
self.threshold = threshold;

    
//beat tracking code
    
    self.numperiods_ = 100;
    self.numpreviousvalues_= 350;
    self.storepos_ = 0;
    self.store_ = new Array(self.numpreviousvalues_);
    self.crosscomby_ = new Array(self.numperiods_);
	
    self.calcperiod_ = 86;
    self.calccounter_ = 0;
    self.amortcounter_ = 0;
    
    self.halftrigdone_= 0;
    self.quartertrigdone_= 0;
    self.threequarterstrigdone_= 0;
    
    var i; //reusable loop counter
    
    for (i=0; i<self.numpreviousvalues_; ++i)
        self.store_[i] = 0.0;
    
    for (i=0; i<self.numperiods_; ++i)
        self.crosscomby_[i] = 0.0;
    
    self.trigger_ = 0;
    
    self.prevbestperiod_ = 50;
    //self.prevbestphase_ = 0;
    self.period_= 50.0;
    self.periodi_ = -1;
    self.phase_ = 0.0;
    self.phasechange_ = 0.0;
    self.periodinsamples_ = 512* self.period_;
    self.phasenowinsamples_= 0;
    self.lastphaseestimate_= 0;
    self.lastperiodestimate_= 50.0;
    
    
    
    //assumes 512 hop size, [100]
    self.g_periods = [ 57.421875, 56.84765625, 56.284808168317, 55.732996323529, 55.191899271845, 54.661207932692, 54.140625, 53.629864386792, 53.128650700935, 52.63671875, 52.153813073394, 51.6796875, 51.21410472973, 50.7568359375, 50.30766039823, 49.866365131579, 49.432744565217, 49.006600215517, 48.587740384615, 48.175979872881, 47.771139705882, 47.373046875, 46.981534090909, 46.59643954918, 46.217606707317, 45.844884072581, 45.478125, 45.1171875, 44.761934055118, 44.412231445313, 44.067950581395, 43.728966346154, 43.395157442748, 43.06640625, 42.742598684211, 42.423624067164, 42.109375, 41.799747242647, 41.49463959854, 41.193953804348, 40.89759442446, 40.60546875, 40.317486702128, 40.033560739437, 39.753605769231, 39.4775390625, 39.205280172414, 38.936750856164, 38.671875, 38.410578547297, 38.15278942953, 37.8984375, 37.647454470199, 37.399773848684, 37.155330882353, 36.9140625, 36.675907258065, 36.440805288462, 36.208698248408, 35.979529272152, 35.753242924528, 35.52978515625, 35.30910326087, 35.091145833333, 34.875862730061, 34.663205030488, 34.453125, 34.245576054217, 34.040512724551, 33.837890625, 33.637666420118, 33.439797794118, 33.244243421053, 33.050962936047, 32.859916907514, 32.671066810345, 32.484375, 32.2998046875, 32.117319915254, 31.936885533708, 31.758467178771, 31.58203125, 31.407544889503, 31.234975961538, 31.064293032787, 30.895465353261, 30.728462837838, 30.563256048387, 30.399816176471, 30.238115026596, 30.078125, 29.919819078947, 29.763170811518, 29.608154296875, 29.454744170984, 29.302915592784, 29.152644230769, 29.00390625, 28.856678299492, 28.7109375 ];
    //int g_periodsnext[100] =[ 57, 56, 56, 55, 55, 54, 54, 53, 53, 52, 52, 51, 51, 50, 50, 49, 49, 49, 48, 48, 47, 47, 46, 46, 46, 45, 45, 45, 44, 44, 44, 43, 43, 43, 42, 42, 42, 41, 41, 41, 40, 40, 40, 40, 39, 39, 39, 38, 38, 38, 38, 37, 37, 37, 37, 36, 36, 36, 36, 35, 35, 35, 35, 35, 34, 34, 34, 34, 34, 33, 33, 33, 33, 33, 32, 32, 32, 32, 32, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30, 29, 29, 29, 29, 29, 29, 29, 28, 28 ];
    [100]
    self.g_periodsprev = [ 58, 57, 57, 56, 56, 55, 55, 54, 54, 53, 53, 52, 52, 51, 51, 50, 50, 50, 49, 49, 48, 48, 47, 47, 47, 46, 46, 46, 45, 45, 45, 44, 44, 44, 43, 43, 43, 42, 42, 42, 41, 41, 41, 41, 40, 40, 40, 39, 39, 39, 39, 38, 38, 38, 38, 37, 37, 37, 37, 36, 36, 36, 36, 36, 35, 35, 35, 35, 35, 34, 34, 34, 34, 34, 33, 33, 33, 33, 33, 32, 32, 32, 32, 32, 32, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30, 30, 29, 29 ];
    
    //[100]
    self.g_periods1minusinterp = [ 0.421875, 0.84765625, 0.28480816831684, 0.73299632352941, 0.19189927184466, 0.66120793269231, 0.140625, 0.62986438679246, 0.12865070093459, 0.63671875000001, 0.1538130733945, 0.67968750000001, 0.21410472972973, 0.7568359375, 0.30766039823009, 0.86636513157895, 0.43274456521739, 0.0066002155172455, 0.58774038461539, 0.17597987288136, 0.77113970588236, 0.37304687500001, 0.98153409090909, 0.59643954918033, 0.21760670731709, 0.84488407258065, 0.47812500000001, 0.11718750000001, 0.76193405511812, 0.41223144531251, 0.067950581395358, 0.72896634615385, 0.39515744274809, 0.066406250000007, 0.74259868421054, 0.42362406716418, 0.10937500000001, 0.79974724264707, 0.49463959854016, 0.19395380434784, 0.89759442446044, 0.60546875000001, 0.31748670212767, 0.033560739436631, 0.75360576923078, 0.47753906250001, 0.20528017241381, 0.93675085616439, 0.67187500000001, 0.41057854729731, 0.15278942953022, 0.89843750000001, 0.64745447019869, 0.39977384868422, 0.15533088235295, 0.91406250000001, 0.67590725806453, 0.44080528846155, 0.20869824840766, 0.97952927215191, 0.75324292452832, 0.52978515625001, 0.30910326086958, 0.091145833333343, 0.87586273006136, 0.66320503048782, 0.45312500000001, 0.24557605421688, 0.040512724550908, 0.83789062500001, 0.63766642011836, 0.43979779411766, 0.24424342105264, 0.050962936046524, 0.85991690751446, 0.67106681034484, 0.48437500000001, 0.29980468750001, 0.11731991525425, 0.93688553370788, 0.75846717877096, 0.58203125000001, 0.40754488950277, 0.23497596153847, 0.064293032786896, 0.89546535326088, 0.72846283783785, 0.56325604838711, 0.3998161764706, 0.23811502659576, 0.078125000000014, 0.91981907894738, 0.76317081151834, 0.60815429687501, 0.45474417098447, 0.30291559278352, 0.15264423076924, 0.0039062500000142, 0.8566782994924, 0.71093750000001 ];
    
    //[100]
    self.g_periodsinterp = [ 0.578125, 0.15234375, 0.71519183168316, 0.26700367647059, 0.80810072815534, 0.33879206730769, 0.859375, 0.37013561320754, 0.87134929906541, 0.36328124999999, 0.8461869266055, 0.32031249999999, 0.78589527027027, 0.2431640625, 0.69233960176991, 0.13363486842105, 0.56725543478261, 0.99339978448275, 0.41225961538461, 0.82402012711864, 0.22886029411764, 0.62695312499999, 0.018465909090907, 0.40356045081967, 0.78239329268291, 0.15511592741935, 0.52187499999999, 0.88281249999999, 0.23806594488188, 0.58776855468749, 0.93204941860464, 0.27103365384615, 0.60484255725191, 0.93359374999999, 0.25740131578946, 0.57637593283582, 0.89062499999999, 0.20025275735293, 0.50536040145984, 0.80604619565216, 0.10240557553956, 0.39453124999999, 0.68251329787233, 0.96643926056337, 0.24639423076922, 0.52246093749999, 0.79471982758619, 0.063249143835606, 0.32812499999999, 0.58942145270269, 0.84721057046978, 0.10156249999999, 0.35254552980131, 0.60022615131578, 0.84466911764705, 0.085937499999986, 0.32409274193547, 0.55919471153845, 0.79130175159234, 0.020470727848092, 0.24675707547168, 0.47021484374999, 0.69089673913042, 0.90885416666666, 0.12413726993864, 0.33679496951218, 0.54687499999999, 0.75442394578312, 0.95948727544909, 0.16210937499999, 0.36233357988164, 0.56020220588234, 0.75575657894736, 0.94903706395348, 0.14008309248554, 0.32893318965516, 0.51562499999999, 0.70019531249999, 0.88268008474575, 0.063114466292124, 0.24153282122904, 0.41796874999999, 0.59245511049723, 0.76502403846153, 0.9357069672131, 0.10453464673912, 0.27153716216215, 0.43674395161289, 0.6001838235294, 0.76188497340424, 0.92187499999999, 0.080180921052619, 0.23682918848166, 0.39184570312499, 0.54525582901553, 0.69708440721648, 0.84735576923076, 0.99609374999999, 0.1433217005076, 0.28906249999999 ];
    

    
  

self.setup = function(sampleRate) {
	var i,j;
	
	
	////////time positions//////////
    //frames were in 64 sample blocks... no longer, now 512/64 = 8
	self.m_frame=0;
	self.m_lastdetect=-100;
    
    if(sampleRate >= (44100*2)) {
        
        self.stft = new MMLLSTFT(self.N * 2,self.NOVER2 * 2,1); // 1 = Hanning window
        
    } else {
        
        self.stft = new MMLLSTFT(self.N,self.NOVER2,1);
    }
    
	
	/////////loudness measure////////
	self.m_dfcounter=self.DFFRAMESSTORED-1;
	//zero loudness store 
	for(j=0;j<self.DFFRAMESSTORED;++j) {
		self.m_df[j]=0.0;
	}
	
    //self.m_loudbands = new Array(self.DFFRAMESSTORED); //[NUMERBBANDS][PASTERBBANDS];
    
	//zero previous specific loudness in Bark bands
    for(j=0;j<self.NUMERBBANDS;++j) {
        
        self.m_loudbands[j] = new Float64Array(self.PASTERBBANDS);
    
        for(i=0;i<self.PASTERBBANDS; ++i)
		{
			self.m_loudbands[j][i] = 0.0;
		}
    }
			
    self.m_pasterbbandcounter=0;
	
	self.m_onsetdetected=0;

	self.m_now=0;
    
    
    
    
    
	
}

    
    self.setup(sampleRate);

//must pass in fft data
self.next = function(input) {

    var beat = 0;
    
    var ready = self.stft.next(input);
    
    if(ready) {
        
    //FFT result analysis
    var fftbuf = self.stft.powers;
    
    //HAVE BEEN PASSED FFT POWERS RESULT
    self.m_frame = self.m_frame+1;
    
	//calculate loudness detection function
	self.calculatedf(fftbuf);
	
        
    //now beat tracker code
        
  
        //just arrived =
        //self.m_df[self.m_dfcounter]
        
        beat = self.beattrackcalculation(self.m_df[self.m_dfcounter] * 0.01);

        //console.log('next1',beat,self.m_df[self.m_dfcounter] * 0.01);
        
    
    }
    
    //1 if beat detected self cycle
    return beat;
    
}
    
    
    self.beattrackcalculation = function(value) {
        
            
            var i, j, k;
            
            var prev, next;
            var prev2, next2;
            var interp;
        
        var beatresult = 0;
      
            self.phase_ += self.phasechange_;
            //lastphaseestimate_ += phasechange_;
            if(self.phase_ > self.period_) {
                self.phase_ -= self.period_;
                self.trigger_ = 1;
                beatresult = 1;
                
                
                //printf("beat %f %f \n", phase_, period_);
                
                
                self.halftrigdone_=0;
                self.quartertrigdone_=0;
                self.threequarterstrigdone_=0;
                
            } else {
                
                //trigger_ = 0;
                
                if((self.quartertrigdone_==0) && ((self.phase_*4.0)>self.period_)) {
                    
                    self.trigger_=2;
                    self.quartertrigdone_=1;
                }
                
                if((self.halftrigdone_==0) && ((2.0*self.phase_)>self.period_)) {
                    
                    self.trigger_=3;
                    self.halftrigdone_=1;
                }
                
                
                if((self.threequarterstrigdone_==0) && ((4.0*self.phase_)>(3.0*self.period_))) {
                    
                    self.trigger_=4;
                    self.threequarterstrigdone_=1;
                }
                
            }
            
            
            
            
            self.store_[self.storepos_] = value;
            
            //update leaky integrators
            for (i=0; i<self.numperiods_; ++i) {
                
                var periodtotest = self.g_periods[i];
                
                var sumup = 0.0;
                
                //sum up to previous four beats compared to now
                
                var basepos = ( self.storepos_ + self.numpreviousvalues_ );
                
                for (k=1; k<=4; ++k) {
       
                    var posthen = (basepos - (k*periodtotest))%self.numpreviousvalues_;
                    
                    prev = Math.floor(posthen);
                    next = (prev+1)%self.numpreviousvalues_;
                    
                    //THIS IS ALWAYS ZERO??????
                    interp = posthen-prev;
                    
                    sumup +=  value* ((self.store_[prev]*(1.0-interp)) + ((interp)*self.store_[next]));
       
                }
                
                
                
                //
                //			prev = ( storepos_ -  g_periodsprev[i] + numpreviousvalues_ ) % numpreviousvalues_;
                //
                //			next = ( prev + 1 ) % numpreviousvalues_;
                //
                //			//should also sum over four previous beats?
                //
                //			mult = value * ( (g_periods1minusinterp[i] * store_[prev]) + (g_periodsinterp[i] * store_[next]) );
                //					crosscomby_[i] = (crosscomby_[i] *0.996) + mult;
                
                
                //0.996
                self.crosscomby_[i] = (self.crosscomby_[i] *0.995) + sumup;
            }
            
            
            if (self.calccounter_ == self.calcperiod_) {
                
                self.lastphaseestimate_= (self.lastphaseestimate_ + self.calcperiod_)%self.lastperiodestimate_;
                
                var bestscore = 0.001;
                var secondbestscore = 0.001;
                var besti=0, secondi=0;
                
                //find best scoring crosscomby
                for (i=0; i<self.numperiods_; ++i) {
                    
                    var now = self.crosscomby_[i];
                    
                    if (now>bestscore) {
                        
                        if(bestscore>secondbestscore) {
                            
                            secondbestscore = bestscore;
                            secondi = besti;
                        }
                        
                        
                        bestscore  = now;
                        besti = i;
                        
                    } else if (now>secondbestscore) {
                        
                        
                        secondbestscore = now;
                        secondi = i;
                    }
                    
                    
                    
                    
                }
   
                
                //printf("checks %f %f best %d prevbest %d\n", bestscore, secondbestscore, besti, prevbestperiod_);
     
                
                var period = self.g_periods[besti];
                
                //printf("last period %f new period %f\n", period_, period);
                
                //int sameperiodflag = (periodi_ == besti)?1:0;
                
                //now have candidate tempo; check 20 possible phases.
                
                //( storepos_ -  (4*period) + numpreviousvalues_ ) % numpreviousvalues_;
                
                var phasediv = period/20.0;
                
                var bestphasescore = 0.0;
                var bestphase = 0.0;
                
                var bestphasej = 0;
                
                var basecalc =  self.storepos_ -  (4*period)  + self.numpreviousvalues_ ;
                
                //try 20 phases, summing over four beats
                for (j=0; j<20; ++j) {
                    
                    var basephasepos = (basecalc + (j*phasediv))%self.numpreviousvalues_;
                    
                    var summation = 0.0;
                    
                    for (k=0; k<4; ++k) {
                        
                        var phasenow = (basephasepos+ (k*period))%self.numpreviousvalues_;
                        
                        prev = phasenow;
                        next = (prev+1)%self.numpreviousvalues_;
                        
                        prev2 = prev>0?(prev-1):self.numpreviousvalues_;
                        next2 = (next+1)%self.numpreviousvalues_;
                        
                        interp = phasenow-prev;
                        
                        //summation +=  (store_[prev]*(1.0-interp)) + ((interp)*store_[next]);
                        summation +=  ((self.store_[prev]+self.store_[prev2])*(1.0-interp)) + ((interp)*(self.store_[next]+self.store_[next2]));
                        
                    }
                    
                    if(summation > bestphasescore) {
                        
                        bestphasescore = summation;
                        bestphasej = j;
                        bestphase = (basephasepos+ (3.0*period))%self.numpreviousvalues_;
                        
                    }
                    
                }
                
                //if two consistent estimates for phase in a row, then update phase; else get lots of skipped beats when phase clock resets mid flow
                
                var phaseestimate = (self.storepos_ - bestphase + self.numpreviousvalues_)%self.numpreviousvalues_;
                
                var phasedifference1 =  (phaseestimate - self.lastphaseestimate_ +period )%period;
                var phasedifference2 =  (self.lastphaseestimate_ - phaseestimate  +period )%period;
                var phasedifference = phasedifference1< phasedifference2?phasedifference1: phasedifference2;
                
                self.phasechange_ = 1.0;
              
                
                //printf("phase stringency %f %f diff %f\n", phaseestimate, lastphaseestimate_,phasedifference);
         
                
                //&& ((bestscore/secondbestscore)>1.1)
                
                
                if( Math.abs(besti-self.prevbestperiod_)<3.0 ) {
                    
                    if (phasedifference<(period*0.125)) { 
                        
                        self.periodi_ = besti;
                        
                        self.period_ = period; // * 512.0;
                        self.periodinsamples_ = 512* self.period_;
                        
                        self.phase_ = phaseestimate; //fmod( storepos_ - bestphase + numpreviousvalues_, numpreviousvalues_) ; //phase AT THIS POINT IN TIME
                        
                    }
                    
                } 
                
                
                self.lastphaseestimate_ = self.phase_;  //actually meaningless unless same period to compare
     
                //update if close enough
                
                self.prevbestperiod_ = besti;
                self.lastperiodestimate_ = period;
                
                self.calccounter_ = 0;
            }
            
            self.storepos_ = (self.storepos_ + 1)% self.numpreviousvalues_;
            
            ++self.calccounter_;
        
        return beatresult;
        
    }


	   
//should take fft data
self.calculatedf = function(fftbuf) {
	
	var h, j,k;
	
    //TO SORT
	//float * fftbuf= self.m_FFTBuf;
	
	var dfsum=0.0;
	
	var pastband = self.m_pasterbbandcounter;
	
    var bandstart, bandsize, bsum;
    
    var db, prop, lastloud, diff;
    
	for (k=0; k<self.NUMERBBANDS; ++k){
		
		bandstart = self.eqlbandbins[k];
		//int bandend=eqlbandbins[k+1];
		bandsize = self.eqlbandsizes[k];
		
		bsum = 0.0;
		
		for (h=0; h<bandsize;++h) {
			bsum = bsum+fftbuf[h+bandstart];  //SORT
		}
		
		//store recips of bandsizes?
		bsum = bsum/bandsize;
		
		//into dB, avoid log of 0
		//float db= 10*log10((bsum*10 000 000)+0.001);
		//db = 10*Math.log10((bsum*32382)+0.001);
        
        //empirically determined. If FFT max magnitudes around 512 (half 1024) say (though rarely would see anything max out at all, might see 5 in a band!)
        
        //(10**11)/(512**2)
        db = 10*Math.log10((bsum*381469.7265625)+0.001);
        
        
        
        //near halfway ERB
//        if(k==20) {
//            console.log("db", db, "bsum", bsum, "fftval",fftbuf[bandstart]);
//            
//        }
		
		//printf("bsum %f db %f \n",bsum,db);
		
		//convert via contour
		if(db<self.contours[k][0]) db=0;
        else if (db>self.contours[k][10]) db=self.phons[10];
        else {
            
            prop = 0.0;
			
            for (j=1; j<11; ++j) {
                if(db<self.contours[k][j]) {
                    prop = (db-self.contours[k][j-1])/(self.contours[k][j]-self.contours[k][j-1]);
                    break;
				}
				
				if(j==10) 
					prop = 1.0;
            }
			
            db = (1.0-prop)*self.phons[j-1]+ prop*self.phons[j];
			//printf("prop %f db %f j %d\n",prop,db,j);
			
		}
		
		//float lastloud=self.m_loudbands[k];
        lastloud = 0.0;
		
		for(j=0;j<self.PASTERBBANDS; ++j)
			lastloud += self.m_loudbands[k][j];
		
		lastloud /= self.PASTERBBANDS;
		
        diff = db-lastloud;
        
        if(diff<0.0) diff = 0.0;
        
        //sc_max(db-lastloud,0.0);
		
		dfsum = dfsum+diff; //(bweights[k]*diff);
		
		self.m_loudbands[k][pastband] = db;
	}
	
	self.m_pasterbbandcounter = (pastband+1)%self.PASTERBBANDS;
	
	//increment first so self frame is self.m_dfcounter
	self.m_dfcounter = (self.m_dfcounter+1)%self.DFFRAMESSTORED;
	
	self.m_df[self.m_dfcounter] = dfsum*0.025; //divide by num of bands to get a dB answer
	
	//printf("loudness %f %f \n",self.loudness[self.loudnesscounter], lsum);

}

    
}



