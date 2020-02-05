

# Sema – Live Code Language Design Playground #
[![Build Status](https://travis-ci.com/mimic-sussex/sema.svg?branch=master)](https://travis-ci.com/mimic-sussex/sema)
[![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg)](https://github.com/emersion/stability-badges#experimental)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/mimic-sussex/eppEditor/blob/master/CONTRIBUTING.md)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mimic-sussex/sema/blob/master/LICENSE)
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
 - [Node.js](https://nodejs.org/en/download/) version 8.9 or higher
 - [Yarn](https://yarnpkg.com/en/) OR [NPM cli](https://docs.npmjs.com/cli/npm)
 

## How to build and run the Sema playground on your machine 

If you decide to go with Yarn (our prefered package manager), use:
```sh
cd sema
yarn
yarn build
yarn dev
```

If you decide to go with NPM instead, use:

```sh
cd sema
npm install
npm run build
npm run dev
```

Now Sema is running at `http://localhost:8080/`!

## Documentation

[Livecoding with the default grammar](doc/LiveCodingAPI_defaultGrammar.md)

[Sema Intermediate Language](doc/semaIR.md)

[Data storage and loading](doc/Model_loading_storing.md)

[Maximilian DSP Library API](doc/maxi_API_doc.md)
