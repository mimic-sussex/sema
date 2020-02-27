

# Sema – Live Code Language Design Playground #
<<<<<<< HEAD
![version](https://img.shields.io/badge/version-0.3-red)
[![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg)](https://github.com/emersion/stability-badges#experimental)
[![Build Status](https://travis-ci.com/mimic-sussex/sema.svg?branch=master)](https://travis-ci.com/mimic-sussex/sema)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mimic-sussex/sema/blob/master/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/mimic-sussex/eppEditor/blob/master/CONTRIBUTING.md)
=======
[![Build Status](https://travis-ci.com/mimic-sussex/sema.svg?branch=master)](https://travis-ci.com/mimic-sussex/sema)
[![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg)](https://github.com/emersion/stability-badges#experimental)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/mimic-sussex/eppEditor/blob/master/CONTRIBUTING.md)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mimic-sussex/sema/blob/master/LICENSE)
>>>>>>> sema_v0.3
<br />

Sema is a playground where you can rapidly prototype live coding mini-languages for signal synthesis, machine learning and machine listening. 

Sema aims to provide an online integrated environment for designing both abstract high-level languages and more powerful low-level languages.

Sema implements a set of core design principles:

* Integrated signal engine – There is no conceptual split between the language and signal engine. Everything is a signal.

* Single sample signal processing – Per-sample sound processing for supporting techniques that use feedback loops, such as physical modelling, reverberation and IIR filtering.

* Sample rate transduction – It is simpler to do signal processing with one principal sample rate, the audio rate. Different sample rate requirements of dependent objects can be resolved by upsampling and downsampling, using a transducer. The transducer concept enables us to accommodate a variety of processes with varying sample rates (video, spectral rate, sensors, ML model inference) within a single engine.

* Minimal abstractions – There are no high-level abstractions such as buses, synths, nodes, servers, or any language scaffolding in our signal engine. Such abstractions sit within the end-user language design space.

## Dependencies

Sema requires the following dependencies to be installed:

 - [Chrome browser](https://www.google.com/chrome/) or any Chromium-based browser (e.g. Brave, Microsoft Edge, Opera)
 - [Node.js](https://nodejs.org/en/download/) version v11.10.0 or higher
 - [NPM cli](https://docs.npmjs.com/cli/npm) OR [Yarn](https://yarnpkg.com/en/)
 

## How to build and run the Sema playground on your machine 


If you decide to use NPM, use:

```sh
cd sema
npm install
npm run dev
npm run go
```

If you decide to go with Yarn (our preferred package manager), to install it: 
```
npm install -g yarn
```

To use Yarn:
```sh
cd sema
yarn
yarn dev
yarn go
```

## Linux Users

Sema uses audio worklets. Their performance seems very sensitive to CPU power scaling. If you are experiencing sound quality issues, try setting the CPU governor to *performance* mode. e.g on Ubuntu,

```cpupower frequency-set --governor performance```


## Documentation

[Livecoding with the default grammar](doc/LiveCodingAPI_defaultGrammar.md)

[Sema Intermediate Language](doc/semaIR.md)

[Data storage and loading](doc/Model_loading_storing.md)

[Maximilian DSP Library API](doc/maxi_API_doc.md)
