
var kissFFTModule = KissFFTModule({});

var kiss_fftr_alloc = kissFFTModule.cwrap(
    'kiss_fftr_alloc', 'number', ['number', 'number', 'number', 'number' ]
);

var kiss_fftr = kissFFTModule.cwrap(
    'kiss_fftr', 'void', ['number', 'number', 'number' ]
);

var kiss_fftri = kissFFTModule.cwrap(
    'kiss_fftri', 'void', ['number', 'number', 'number' ]
);

var kiss_fftr_free = kissFFTModule.cwrap(
    'kiss_fftr_free', 'void', ['number']
);

var kiss_fft_alloc = kissFFTModule.cwrap(
    'kiss_fft_alloc', 'number', ['number', 'number', 'number', 'number' ]
);

var kiss_fft = kissFFTModule.cwrap(
    'kiss_fft', 'void', ['number', 'number', 'number' ]
);

var kiss_fft_free = kissFFTModule.cwrap(
    'kiss_fft_free', 'void', ['number']
);

var FFT = function (size) {

    var self = this;
    
    self.size = size;
    self.fcfg = kiss_fft_alloc(size, false);
    self.icfg = kiss_fft_alloc(size, true);
    
    self.inptr = kissFFTModule._malloc(size*8 + size*8);
    self.outptr = self.inptr + size*8;
    
    self.cin = new Float32Array(kissFFTModule.HEAPU8.buffer, self.inptr, size*2);
    self.cout = new Float32Array(kissFFTModule.HEAPU8.buffer, self.outptr, size*2);
    
    self.forward = function(cin) {
	self.cin.set(cin);
	kiss_fft(self.fcfg, self.inptr, self.outptr);
	return new Float32Array(kissFFTModule.HEAPU8.buffer,
				self.outptr, self.size * 2);
    };
    
    self.inverse = function(cin) {
	self.cin.set(cpx);
	kiss_fft(self.icfg, self.inptr, self.outptr);
	return new Float32Array(kissFFTModule.HEAPU8.buffer,
				self.outptr, self.size * 2);
    };
    
    self.dispose = function() {
	kissFFTModule._free(self.inptr);
	kiss_fft_free(self.fcfg);
	kiss_fft_free(self.icfg);
    }
};

var FFTR = function (size) {

    var self = this;
    
    self.size = size;
    self.fcfg = kiss_fftr_alloc(size, false);
    self.icfg = kiss_fftr_alloc(size, true);
    
    self.rptr = kissFFTModule._malloc(size*4 + (size+2)*4);
    self.cptr = self.rptr + size*4;
    
    self.ri = new Float32Array(kissFFTModule.HEAPU8.buffer, self.rptr, size);
    self.ci = new Float32Array(kissFFTModule.HEAPU8.buffer, self.cptr, size+2);
    
//    self.outputptr = kissFFTModule._malloc((size+2)*4);
//    self.output = new Float32Array(kissFFTModule.HEAPU8.buffer,
//                               self.outputptr, self.size + 2);
//    
    self.forward = function(real,output) {
	self.ri.set(real);
	kiss_fftr(self.fcfg, self.rptr, self.cptr);
        
        
    //can replace with fixed buffer rather than new each time? Is there danger if returned from self function that memory never freed and eventually runs out?
	//return new Float32Array(kissFFTModule.HEAPU8.buffer, self.cptr, self.size + 2);
        
        output.set(self.ci);
      
        //calling code musn't destroy self?
        //return self.output;
        
    };
    
    self.inverse = function(cpx,output) {
	self.ci.set(cpx);
	kiss_fftri(self.icfg, self.cptr, self.rptr);
	//return new Float32Array(kissFFTModule.HEAPU8.buffer,
				//self.rptr, self.size);
      
        output.set(self.ri);
        
    };
    
    self.dispose = function() {
	kissFFTModule._free(self.rptr);
	kiss_fftr_free(self.fcfg);
	kiss_fftr_free(self.icfg);
    }
};

//module.exports = {
//    FFT: FFT,
//    FFTR: FFTR
//};
