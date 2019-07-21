  var lstmLayerSizes;
  var learningRate; 
  var numEpochs; 
  var examplesPerEpoch; 
  var batchSize; 
  var validationSplit;
  var sentenceIndices;
  var length;
  var temperature;

  createModel(lstmLayerSizes) {
    if (!Array.isArray(lstmLayerSizes)) {
      lstmLayerSizes = [lstmLayerSizes];
    }

    this.model = tf.sequential();
    for (let i = 0; i < lstmLayerSizes.length; ++i) {
      const lstmLayerSize = lstmLayerSizes[i];
      this.model.add(tf.layers.lstm({
        units: lstmLayerSize,
        returnSequences: i < lstmLayerSizes.length - 1,
        inputShape: i === 0 ? [this.sampleLen_, this.charSetSize_] : undefined
      }));
    }
    this.model.add(
        tf.layers.dense({units: this.charSetSize_, activation: 'softmax'}));
  }

  compileModel(learningRate) {
    const optimizer = tf.train.rmsprop(learningRate);
    this.model.compile({optimizer: optimizer, loss: 'categoricalCrossentropy'});
    console.log(`Compiled model with learning rate ${learningRate}`);
    this.model.summary();
  }

  async fitModel(numEpochs, examplesPerEpoch, batchSize, validationSplit) {
    let batchCount = 0;
    const batchesPerEpoch = examplesPerEpoch / batchSize;
    const totalBatches = numEpochs * batchesPerEpoch;

    onTrainBegin();
    await tf.nextFrame();

    let t = new Date().getTime();
    for (let i = 0; i < numEpochs; ++i) {
      const [xs, ys] = this.textData_.nextDataEpoch(examplesPerEpoch);
      await this.model.fit(xs, ys, {
        epochs: 1,
        batchSize: batchSize,
        validationSplit,
        callbacks: {
          onBatchEnd: async (batch, logs) => {
            // Calculate the training speed in the current batch, in # of
            // examples per second.
            const t1 = new Date().getTime();
            const examplesPerSec = batchSize / ((t1 - t) / 1e3);
            t = t1;
            onTrainBatchEnd(logs, ++batchCount / totalBatches, examplesPerSec);
          },
          onEpochEnd: async (epoch, logs) => {
            onTrainEpochEnd(logs);
          },
        }
      });
      xs.dispose();
      ys.dispose();
    }
  }

  async generateText(sentenceIndices, length, temperature) {
    onTextGenerationBegin();
    const temperatureScalar = tf.scalar(temperature);

    let generated = '';
    while (generated.length < length) {
      // Encode the current input sequence as a one-hot Tensor.
      const inputBuffer =
          new tf.TensorBuffer([1, this.sampleLen_, this.charSetSize_]);
      for (let i = 0; i < this.sampleLen_; ++i) {
        inputBuffer.set(1, 0, i, sentenceIndices[i]);
      }
      const input = inputBuffer.toTensor();

      // Call model.predict() to get the probability values of the next
      // character.
      const output = this.model.predict(input);

      // Sample randomly based on the probability values.
      const winnerIndex = sample(tf.squeeze(output), temperatureScalar);
      const winnerChar = this.textData_.getFromCharSet(winnerIndex);
      await onTextGenerationChar(winnerChar);

      generated += winnerChar;
      sentenceIndices = sentenceIndices.slice(1);
      sentenceIndices.push(winnerIndex);

      input.dispose();
      output.dispose();
    }
    temperatureScalar.dispose();
    return generated;
  }
  