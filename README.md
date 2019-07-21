# Sema – Live Coding Language Design Playground #

Sema is a playground where you can rapid prototype mini-languages for live coding that integrate signal synthesis, machine learning and machine listening. 

Sema provides an online integrated environment that implements support for designing both abstract high-level languages and more powerful low-level languages.

* Integrated signal engine — There is no conceptual split between the language and signal engine. Everything is a signal.

* Single sample signal processing – Per-sample sound processing including techniques that use feedback loops, such as physical modelling, reverberation and IIR filtering.

* Sample rate transduction – It is simpler to do signal processing with one principal sample rate, the audio rate. Different sample rate requirements of dependent objects can be resolved by upsampling and downsampling, using a transducer. The transducer concept enables us to accommodate a variety of processes with varying sample rates (video, spectral rate, sensors, ML model inference) within a single engine.

* Minimal abstractions — There are no high-level abstractions such as buses, synths, nodes, servers, or any language scaffolding in our signal engine. Such abstractions sit within the end-user mini-language design space.

## Dependencies

Sema requires the following dependencies to be installed:

 - Node.js version 8.9 or higher
 - [NPM cli](https://docs.npmjs.com/cli/npm) OR [Yarn](https://yarnpkg.com/en/)

## How to build and run the Sema playground on your machine 

```sh
cd sema
yarn
yarn build
yarn dev
```

## Documentation

[Livecoding with the default grammar](doc/LiveCodingAPI_defaultGrammar.md)
