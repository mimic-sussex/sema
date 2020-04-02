class PostMsgTransducer {

  constructor(msgPort, sampleRate, sendFrequency = 2, name, transducerType) {
    if (sendFrequency == 0)
      this.sendPeriod = Number.MAX_SAFE_INTEGER;
    else
      this.sendPeriod = 1.0 / sendFrequency * sampleRate;
    this.sendCounter = this.sendPeriod;
    this.port = msgPort;
    this.val = 0;
    this.name=name;
    this.transducerType = transducerType;
  }

  incoming(msg) {
    this.val = msg.value;
  }

  send(id, sendMsg) {
    if (this.sendCounter >= this.sendPeriod) {
      this.port.postMessage({
        rq: "send",
        value: sendMsg,
        id: id,
        ttype: this.transducerType
      });
      this.sendCounter -= this.sendPeriod;
    } else {
      this.sendCounter++;
    }
    return 0;
  }

  receive(sendMsg) {
    if (this.sendCounter >= this.sendPeriod) {
      this.port.postMessage({
        rq: "receive",
        value: sendMsg,
        transducerName: this.name,
        ttype: this.transducerType
      });
      this.sendCounter -= this.sendPeriod;
    } else {
      this.sendCounter++;
    }
    return this.val;
  }

  // io(sendMsg) {
  //   if (this.sendCounter >= this.sendPeriod) {
  //     this.port.postMessage({
  //       rq: "dataplease",
  //       value: sendMsg
  //     });
  //     this.sendCounter -= this.sendPeriod;
  //   } else {
  //     this.sendCounter++;
  //   }
  //   return this.val;
  // }
}

export PostMsgTransducer;
