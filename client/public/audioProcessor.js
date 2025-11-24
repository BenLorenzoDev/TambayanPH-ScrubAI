class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array();

    this.port.onmessage = (event) => {
      const incomingData = event.data.audioData;
      const newBuffer = new Float32Array(this.buffer.length + incomingData.length);
      newBuffer.set(this.buffer, 0);
      newBuffer.set(incomingData, this.buffer.length);
      this.buffer = newBuffer;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const leftChannel = output[0];
    const rightChannel = output[1];

    if (!leftChannel) return true;

    const samplesToProcess = Math.min(leftChannel.length, this.buffer.length);

    for (let i = 0; i < leftChannel.length; i++) {
      if (i < samplesToProcess) {
        leftChannel[i] = this.buffer[i];
        if (rightChannel) {
          rightChannel[i] = this.buffer[i];
        }
      } else {
        leftChannel[i] = 0;
        if (rightChannel) {
          rightChannel[i] = 0;
        }
      }
    }

    // Remove processed samples
    this.buffer = this.buffer.slice(samplesToProcess);
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
