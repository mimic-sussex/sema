//short term Fourier transform
//currently just calculates power spectrum, could modify later for phase spectrum etc

function MMLLSTFT(fftsize = 1024, hopsize = 512, windowtype = 0, postfftfunction) {

  var self = this;

  self.fftsize = fftsize;
  self.hopsize = hopsize; //typically halffftsize, but windowing should cope otherwise too
  self.halffftsize = fftsize / 2;
  self.windowtype = windowtype;
  self.postfftfunction = postfftfunction;

  self.windowing = new MMLLwindowing(self.fftsize, self.hopsize);
  //self.fft = new MMLLFFT(); //
  self.fft = new FFTR(fftsize);

  //self.fft.setupFFT(fftsize);

  self.windowdata = new Float32Array(self.fftsize); //begins as zeroes
  self.hanning = new Float32Array(self.fftsize);

  var ang = (2.0 * Math.PI) / self.fftsize;

  for (var i = 0; i < fftsize; ++i)
    self.hanning[i] = 0.5 - 0.5 * Math.cos(ang * i);

  //initialised containing zeroes
  self.powers = new Float32Array(self.halffftsize);
  //var freqs = result.subarray(result.length / 2);
  self.reals = new Float32Array(self.fftsize);

  self.complex = new Float32Array(self.fftsize + 2);

  //self.imags = new Float32Array(self.fftsize);

  //4 =2*2 compensates for half magnitude if only take non-conjugate part, fftsize compensates for 1/N
  self.fftnormmult = 4 * self.fftsize; //*fftsize;// /4; //1.0/fftsize;  or 1/(fftsize.sqrt)

  self.next = function (input) {

    //update by audioblocksize samples
    var ready = self.windowing.next(input);

    if (ready) {

      //no window function (square window)
      if (self.windowtype == 0) {
        for (i = 0; i < self.fftsize; ++i) {
          self.reals[i] = self.windowing.store[i]; //*hanning[i];
          //self.imags[i] = 0.0;

        }
      } else {
        for (i = 0; i < self.fftsize; ++i) {
          self.reals[i] = self.windowing.store[i] * self.hanning[i];
          //self.imags[i] = 0.0;

        }
      }

      //fft library call
      //self.fft.transform(self.reals, self.imags);
      //var output = self.fft.forward(self.reals);

      self.fft.forward(self.reals, self.complex);

      //output format is interleaved k*2, k*2+1 real and imag parts
      //DC and 0 then bin 1 real and imag ... nyquist and 0

      //power spectrum not amps, for comparative testing
      for (var k = 0; k < self.halffftsize; ++k) {
        //Math.sqrt(
        var twok = 2 * k;
        //self.powers[k] = ((output[twok] * output[twok]) + (output[twok+1] * output[twok+1]) ); // * fftnormmult;

        self.powers[k] = ((self.complex[twok] * self.complex[twok]) + (self.complex[twok + 1] * self.complex[twok + 1]));

        //will scale later in onset detector itself

        //self.powers[k] = ((self.reals[k] * self.reals[k]) + (self.imags[k] * self.imags[k]) ); // * fftnormmult;

        //freqs[k - align] = (2 * k / N) * (sample_rate / 2);
      }

      //console.log(self.postfftfunction,'undefined');

      if (self.postfftfunction !== undefined)
        self.postfftfunction(self.powers, self.complex); //could pass self.complex as second argument to get phase spectrum etc


    }

    return ready;

  }



}



//Nick Collins 13/6/05 onset detection MIREX algorithm (adapted from SC3 UGen for stream based calculation)
//C code version Nick Collins 20 May 2005
//js version 2018
//trying to implement the best onset detection algo from AES118 paper, with event analysis data to be written to a buffer
//for potential NRT and RT use
//stores up to a second of audio, assumes that events are not longer than that minus a few FFT frames
//assumes 44100 SR and FFT of 1024, 512 overlap



//assumes sampling rate 44.1kHz
//assumes blocksizes itself?
//function OnsetDetector(N,SR)


export const MMLLOnsetDetector = (sampleRate = 44100, threshold = 0.34) => {

  var self = this;
  //helpful constants

  //assumes fixed sampling rate
  //FFT data
  self.N = 1024
  self.NOVER2 = 512
  //    self.OVERLAP = 512
  //    self.OVERLAPINDEX = 512
  //    self.HOPSIZE = 512
  //    self.FS = 44100
  //    self.FRAMESR = 172.2656
  //    self.FRAMEPERIOD = 0.00581
  //    
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

  //    self.MAXBLOCKSIZE = 64;
  //    self.MAXBLOCKS = 700;



  //time positions
  //var m_frame;
  //var m_lastdetect;

  //loudness measure
  self.m_loudbands = new Array(self.NUMERBBANDS); //[NUMERBBANDS][PASTERBBANDS]; //stores previous loudness bands
  //var m_pasterbbandcounter;
  self.m_df = new Float64Array(self.DFFRAMESSTORED);
  //self.m_dfcounter;

  //recording state
  //self.m_onsetdetected;

  //[43]
  self.eqlbandbins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 15, 17, 19, 22, 25, 28, 32, 36, 41, 46, 52, 58, 65, 73, 82, 92, 103, 116, 129, 144, 161, 180, 201, 225, 251, 280, 312, 348, 388, 433, 483, 513];
  //[42]
  //last entry was 30, corrected to 29 to avoid grabbing nyquist value, only half fftsize bins actually calculated for power
  //safe anyway since only 40 ERB bands used
  self.eqlbandsizes = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 11, 13, 13, 15, 17, 19, 21, 24, 26, 29, 32, 36, 40, 45, 50, 29];

  //[42][11]
  self.contours = [
    [47.88, 59.68, 68.55, 75.48, 81.71, 87.54, 93.24, 98.84, 104.44, 109.94, 115.31],
    [29.04, 41.78, 51.98, 60.18, 67.51, 74.54, 81.34, 87.97, 94.61, 101.21, 107.74],
    [20.72, 32.83, 43.44, 52.18, 60.24, 67.89, 75.34, 82.70, 89.97, 97.23, 104.49],
    [15.87, 27.14, 37.84, 46.94, 55.44, 63.57, 71.51, 79.34, 87.14, 94.97, 102.37],
    [12.64, 23.24, 33.91, 43.27, 52.07, 60.57, 68.87, 77.10, 85.24, 93.44, 100.90],
    [10.31, 20.43, 31.03, 40.54, 49.59, 58.33, 66.89, 75.43, 83.89, 92.34, 100.80],
    [8.51, 18.23, 28.83, 38.41, 47.65, 56.59, 65.42, 74.16, 82.89, 91.61, 100.33],
    [7.14, 16.55, 27.11, 36.79, 46.16, 55.27, 64.29, 73.24, 82.15, 91.06, 99.97],
    [5.52, 14.58, 25.07, 34.88, 44.40, 53.73, 62.95, 72.18, 81.31, 90.44, 99.57],
    [3.98, 12.69, 23.10, 32.99, 42.69, 52.27, 61.66, 71.15, 80.54, 89.93, 99.31],
    [2.99, 11.43, 21.76, 31.73, 41.49, 51.22, 60.88, 70.51, 80.11, 89.70, 99.30],
    [2.35, 10.58, 20.83, 30.86, 40.68, 50.51, 60.33, 70.08, 79.83, 89.58, 99.32],
    [2.05, 10.12, 20.27, 30.35, 40.22, 50.10, 59.97, 69.82, 79.67, 89.52, 99.38],
    [2.00, 9.93, 20.00, 30.07, 40.00, 49.93, 59.87, 69.80, 79.73, 89.67, 99.60],
    [2.19, 10.00, 20.00, 30.00, 40.00, 50.00, 59.99, 69.99, 79.98, 89.98, 99.97],
    [2.71, 10.56, 20.61, 30.71, 40.76, 50.81, 60.86, 70.96, 81.01, 91.06, 101.17],
    [3.11, 11.05, 21.19, 31.41, 41.53, 51.64, 61.75, 71.95, 82.05, 92.15, 102.33],
    [2.39, 10.69, 21.14, 31.52, 41.73, 51.95, 62.11, 72.31, 82.46, 92.56, 102.59],
    [1.50, 10.11, 20.82, 31.32, 41.62, 51.92, 62.12, 72.32, 82.52, 92.63, 102.56],
    [-0.17, 8.50, 19.27, 29.77, 40.07, 50.37, 60.57, 70.77, 80.97, 91.13, 101.23],
    [-1.80, 6.96, 17.77, 28.29, 38.61, 48.91, 59.13, 69.33, 79.53, 89.71, 99.86],
    [-3.42, 5.49, 16.36, 26.94, 37.31, 47.61, 57.88, 68.08, 78.28, 88.41, 98.39],
    [-4.73, 4.38, 15.34, 25.99, 36.39, 46.71, 57.01, 67.21, 77.41, 87.51, 97.41],
    [-5.73, 3.63, 14.74, 25.48, 35.88, 46.26, 56.56, 66.76, 76.96, 87.06, 96.96],
    [-6.24, 3.33, 14.59, 25.39, 35.84, 46.22, 56.52, 66.72, 76.92, 87.04, 97.00],
    [-6.09, 3.62, 15.03, 25.83, 36.37, 46.70, 57.00, 67.20, 77.40, 87.57, 97.68],
    [-5.32, 4.44, 15.90, 26.70, 37.28, 47.60, 57.90, 68.10, 78.30, 88.52, 98.78],
    [-3.49, 6.17, 17.52, 28.32, 38.85, 49.22, 59.52, 69.72, 79.92, 90.20, 100.61],
    [-0.81, 8.58, 19.73, 30.44, 40.90, 51.24, 61.52, 71.69, 81.87, 92.15, 102.63],
    [2.91, 11.82, 22.64, 33.17, 43.53, 53.73, 63.96, 74.09, 84.22, 94.45, 104.89],
    [6.68, 15.19, 25.71, 36.03, 46.25, 56.31, 66.45, 76.49, 86.54, 96.72, 107.15],
    [10.43, 18.65, 28.94, 39.02, 49.01, 58.98, 68.93, 78.78, 88.69, 98.83, 109.36],
    [13.56, 21.65, 31.78, 41.68, 51.45, 61.31, 71.07, 80.73, 90.48, 100.51, 111.01],
    [14.36, 22.91, 33.19, 43.09, 52.71, 62.37, 71.92, 81.38, 90.88, 100.56, 110.56],
    [15.06, 23.90, 34.23, 44.05, 53.48, 62.90, 72.21, 81.43, 90.65, 99.93, 109.34],
    [15.36, 23.90, 33.89, 43.31, 52.40, 61.42, 70.29, 79.18, 88.00, 96.69, 105.17],
    [15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00, 101.70],
    [15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00, 101.70],
    [15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00, 101.70],
    [15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00, 101.70],
    [15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00, 101.70],
    [15.60, 23.90, 33.60, 42.70, 51.50, 60.20, 68.70, 77.30, 85.80, 94.00, 101.70]
  ];
  //[11]
  self.phons = [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  //empirically determined default value
  self.threshold = threshold;





  self.setup = function (sampleRate) {
    var i, j;


    ////////time positions//////////
    //frames were in 64 sample blocks... no longer, now 512/64 = 8
    self.m_frame = 0;
    self.m_lastdetect = -100;



    if (sampleRate >= (44100 * 2)) {

      self.stft = new MMLLSTFT(self.N * 2, self.NOVER2 * 2, 1); // 1 = Hanning window

    } else {

      self.stft = new MMLLSTFT(self.N, self.NOVER2, 1);
    }


    /////////loudness measure////////
    self.m_dfcounter = self.DFFRAMESSTORED - 1;
    //zero loudness store 
    for (j = 0; j < self.DFFRAMESSTORED; ++j) {
      self.m_df[j] = 0.0;
    }

    //self.m_loudbands = new Array(self.DFFRAMESSTORED); //[NUMERBBANDS][PASTERBBANDS];

    //zero previous specific loudness in Bark bands


    for (j = 0; j < self.NUMERBBANDS; ++j) {

      self.m_loudbands[j] = new Float64Array(self.PASTERBBANDS);

      for (i = 0; i < self.PASTERBBANDS; ++i) {
        self.m_loudbands[j][i] = 0.0;
      }
    }

    self.m_pasterbbandcounter = 0;

    self.m_onsetdetected = 0;

    self.m_now = 0;

  }


  self.setup(sampleRate);

  //must pass in fft data
  self.next = function (input) {

    self.m_onsetdetected = 0;

    var ready = self.stft.next(input);

    if (ready) {

      //FFT result analysis
      var fftbuf = self.stft.powers;

      //HAVE BEEN PASSED FFT POWERS RESULT
      self.m_frame = self.m_frame + 1;

      //calculate loudness detection function
      self.calculatedf(fftbuf);

      //use detection function
      self.peakpickdf();

    }

    //1 if onset detected self cycle
    return self.m_onsetdetected;

    //	if(self.m_onsetdetected) {
    //		
    //        //DO SOMETHING! how communicated back? By return value
    //        
    //		//printf("onset detected %d \n",(self.m_onsetdetected));
    //		
    //		//if(self.m_triggerid) SendTrigger(&self.mParent->mNode, self.m_triggerid, self.m_loudness);
    //		
    //		self.m_onsetdetected=0;
    //		
    //	}
  }



  //    // Look at the real signal as an interleaved complex vector by casting it.
  //    // Then call the transformation function ctoz to get a split complex vector,
  //    // which for a real signal, divides into an even-odd configuration.
  //    vDSP_ctoz ((COMPLEX *) fftbuf, 2, &self.m_vA, 1, NOVER2);
  //	
  //    // Carry out a Forward FFT transform
  //    vDSP_fft_zrip(self.m_vsetup, &self.m_vA, 1, self.m_vlog2n, FFT_FORWARD);
  //	
  //    // The output signal is now in a split real form.  Use the function
  //    // ztoc to get a split real vector.
  //    vDSP_ztoc ( &self.m_vA, 1, (COMPLEX *) fftbuf, 2, NOVER2);
  //	
  //	// Squared Absolute so get power
  //	for (i=0; i<N; i+=2)
  //		//i>>1 is i/2 
  //		fftbuf[i>>1] = (fftbuf[i] * fftbuf[i]) + (fftbuf[i+1] * fftbuf[i+1]);
  //	


  //should take fft data
  self.calculatedf = function (fftbuf) {

    var h, j, k;

    //TO SORT
    //float * fftbuf= self.m_FFTBuf;

    var dfsum = 0.0;

    var pastband = self.m_pasterbbandcounter;

    var bandstart, bandsize, bsum;

    var db, prop, lastloud, diff;

    for (k = 0; k < self.NUMERBBANDS; ++k) {

      bandstart = self.eqlbandbins[k];
      //int bandend=eqlbandbins[k+1];
      bandsize = self.eqlbandsizes[k];

      bsum = 0.0;

      for (h = 0; h < bandsize; ++h) {
        bsum = bsum + fftbuf[h + bandstart]; //SORT
      }

      //store recips of bandsizes?
      bsum = bsum / bandsize;

      //into dB, avoid log of 0
      //float db= 10*log10((bsum*10 000 000)+0.001);
      //db = 10*Math.log10((bsum*32382)+0.001);

      //empirically determined. If FFT max magnitudes around 512 (half 1024) say (though rarely would see anything max out at all, might see 5 in a band!)

      //(10**11)/(512**2)
      db = 10 * Math.log10((bsum * 381469.7265625) + 0.001);



      //near halfway ERB
      //        if(k==20) {
      //            console.log("db", db, "bsum", bsum, "fftval",fftbuf[bandstart]);
      //            
      //        }

      //printf("bsum %f db %f \n",bsum,db);

      //convert via contour
      if (db < self.contours[k][0]) db = 0;
      else if (db > self.contours[k][10]) db = self.phons[10];
      else {

        prop = 0.0;

        for (j = 1; j < 11; ++j) {
          if (db < self.contours[k][j]) {
            prop = (db - self.contours[k][j - 1]) / (self.contours[k][j] - self.contours[k][j - 1]);
            break;
          }

          if (j == 10)
            prop = 1.0;
        }

        db = (1.0 - prop) * self.phons[j - 1] + prop * self.phons[j];
        //printf("prop %f db %f j %d\n",prop,db,j);

      }

      //float lastloud=self.m_loudbands[k];
      lastloud = 0.0;

      for (j = 0; j < self.PASTERBBANDS; ++j)
        lastloud += self.m_loudbands[k][j];

      lastloud /= self.PASTERBBANDS;

      diff = db - lastloud;

      if (diff < 0.0) diff = 0.0;

      //sc_max(db-lastloud,0.0);

      dfsum = dfsum + diff; //(bweights[k]*diff);

      self.m_loudbands[k][pastband] = db;
    }

    self.m_pasterbbandcounter = (pastband + 1) % self.PASTERBBANDS;

    //increment first so self frame is self.m_dfcounter
    self.m_dfcounter = (self.m_dfcounter + 1) % self.DFFRAMESSTORED;

    self.m_df[self.m_dfcounter] = dfsum * 0.025; //divide by num of bands to get a dB answer

    //printf("loudness %f %f \n",self.loudness[self.loudnesscounter], lsum);

  }


  //score rating peak picker
  self.peakpickdf = function () {
    var i;

    //smoothed already with df looking at average of previous values
    var dfnow = self.m_dfcounter + self.DFFRAMESSTORED;

    //rate the peak in the central position

    var dfassess = ((dfnow - 3) % self.DFFRAMESSTORED) + self.DFFRAMESSTORED;

    //look at three either side

    var pos;
    var val;

    var centreval = self.m_df[dfassess % self.DFFRAMESSTORED];

    //must normalise 
    //printf("centreval %f \n",centreval);

    var score = 0.0;


    //console.log("centreval",centreval, dfnow, dfassess);


    for (i = (-3); i < 4; ++i) {
      pos = (dfassess + i) % self.DFFRAMESSTORED;

      val = centreval - (self.m_df[pos]);

      if (val < 0) val *= 10; //exacerbate negative evidence

      score = score + val;
    }

    //MIREX detector
    //normalise such that df max assumed at 50, 0.02

    //SC UGen
    //normalise such that df max assumed at 200, 0.005, was 50, 0.02


    score *= 0.02;

    //if enough time since last detection
    if ((self.m_frame - self.m_lastdetect) >= self.MINEVENTDUR) {

      //SIMPLE THRESHOLDING PEAKPICKER
      //var threshold = 0.34; //ZIN0(2); //0.34 best in trials

      //printf("threshold %f score %f \n",threshold, score);

      //console.log("peakpick",score,self.threshold);

      if (score >= self.threshold) {
        self.m_lastdetect = self.m_frame;

        self.m_onsetdetected = 1;


      }
    }
  }

}