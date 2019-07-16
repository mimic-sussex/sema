## Sema playground – Live Coding Language Design Environment ##

Sema is a playground where you can rapid prototype mini-languages for live coding that integrate signal synthesis, machine learning and machine listening. 

Sema provides an online integrated environment that implements support a broad spectrum of live coding languages that ranges from abstract high-level languages to more powerful low-level languages, aiming for the an adequate compromise between simplicity and flexibility.

* Single sample signal processing – Per-sample sound processing aords a broad set of sound control and synthesis, including more sophisticated and expressive techniques that use feedback loops, such as physical modelling, reverberation and IIR filtering.

* Sample rate transduction – Signal processing with one principle rate — e.g. audio rate where differences in sample rate requirements of connected objects can be resolved by upsampling and downsampling, using a transducer. The transducer concept enables us to accommodate a variety of processes with varying sample rates (video, spectral rate, sensors, ML model inference) within a single engine. This approach is simpler for end-users than having multiple rates.

* Integrated signal engine There is no conceptual split between the language and signal engine. Everything is a signal.

* Minimal abstractions There are no high-level abstractions such as buses, synths, nodes, servers, or any language scaolding in our signal engine. Such abstractions sit within the end-user mini-language design space.

Required Tools:

Node.js

Yarn 




