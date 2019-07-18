## Sema – Live Coding Language Design Playground ##

Sema is a playground where you can rapid prototype mini-languages for live coding that integrate signal synthesis, machine learning and machine listening. 

Sema provides an online integrated environment that implements support for designing abstract high-level languages to more powerful low-level languages.

* Integrated signal engine – There is no conceptual split between the language and signal engine. Everything is a signal.

* Single sample signal processing – Per-sample sound processing including techniques that use feedback loops, such as physical modelling, reverberation and IIR filtering.

* Single sample rate using transduction – It is simpler to do signal processing using the audio rate as the principal sample rate. We use the concept of a transducer for resolving different sample rate requirements of dependent objects. The transducer concept enables us to accommodate a variety of processes with varying sample rates (video, spectral rate, sensors, ML model inference) within a single engine.

* Minimal abstractions – There are no high-level abstractions such as buses, synths, nodes, servers, or any language scaffolding in our signal engine. Such abstractions sit within the end-user mini-language design space.

Required Tools:

Node.js

Yarn 




