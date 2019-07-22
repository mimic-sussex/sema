let model = new mm.MusicRNN('/melody_rnn'),
    sequence = [],
    stepIdx = 0;

model.initialize();

input = () => {
  let seedSeq = {
    notes: [
      {pitch: 60, quantizedStartStep: 0, quantizedEndStep: 2}
    ],
    quantizationInfo: { stepsPerQuarter: 4 },
    totalQuantizedSteps: 2
  };
  model.continueSequence(seedSeq, 14, 1.25).then(result => {
    sequence = [60, 60];
	for (let i=0 ; i<14 ; i++) {
  	  let pitch = null;
  	  for (let note of result.notes) {
    	if (note.quantizedStartStep <= i && note.quantizedEndStep > i) {
      	  pitch = note.pitch;
    	}
      }
  	  sequence.push(pitch);
	}
  });
};

output = () => {
  let pitch = sequence[stepIdx++ % sequence.length];
  return 440 * 2 ** ((pitch - 69) / 12)
}
