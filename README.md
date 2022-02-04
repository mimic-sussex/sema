
# Sema – A Playground for Live Coding Music and Machine Learning #
![version](https://img.shields.io/badge/version-0.9.0-orange)
[![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg)](https://github.com/emersion/stability-badges#experimental)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-yellow.svg)](https://github.com/mimic-sussex/eppEditor/blob/master/CONTRIBUTING.md)
[![Build Status](https://travis-ci.com/mimic-sussex/sema.svg?branch=master)](https://travis-ci.com/mimic-sussex/sema)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fsema.codes)](https://sema.codes)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mimic-sussex/sema/blob/master/LICENSE)


<br />

Sema is a playground where you can rapidly prototype live coding mini-languages for signal synthesis, machine learning and machine listening.

Sema aims to provide an online integrated environment for designing both abstract high-level languages and more powerful low-level languages.

Sema implements a set of core design principles:

* Integrated signal engine – In terms language and signal engine integration, there is no conceptual split. Everything is a signal. However, for the sake of modularity, reusability, and a sound architecture, sema's signal engine is implemented by the [sema-engine](https://github.com/frantic0/sema-engine) library.

* Single sample signal processing – Per-sample sound processing for supporting techniques that use feedback loops, such as physical modelling, reverberation and IIR filtering.

* Sample rate transduction – It is simpler to do signal processing with one principal sample rate, the audio rate. Different sample rate requirements of dependent objects can be resolved by upsampling and downsampling, using a transducer. The transducer concept enables us to accommodate a variety of processes with varying sample rates (video, spectral rate, sensors, ML model inference) within a single engine.

* Minimal abstractions – There are no high-level abstractions such as buses, synths, nodes, servers, or any language scaffolding in our signal engine. Such abstractions sit within the end-user language design space.

## Dependencies

Sema requires the following dependencies to be installed:

 - [Chrome browser](https://www.google.com/chrome/) or any Chromium-based browser (e.g. Brave, Microsoft Edge, Opera)
 - [Node.js](https://nodejs.org/en/download/) active LTS version (currently v14.4.0). To switch between node versions, you can use [nvm](https://github.com/nvm-sh/nvm).
 - [NPM cli](https://docs.npmjs.com/cli/npm) OR [Yarn](https://yarnpkg.com/en/)

 In order to run, Sema **must connect** with a project url and api key to a **[Supabase backend](https://supabase.com)**.
 - You can either install supabase locally by following [these instructions](https://supabase.com/docs/guides/local-development), or set up a [free hosted project](https://app.supabase.io/).
 - Next, follow the steps on [how to connect to a supabase backend](https://github.com/mimic-sussex/sema/wiki/Getting-set-up-for-development-with-Sema#connecting-to-a-supabase-backend).

## How to build and run the Sema playground on your machine

If you decide to use `npm` to build sema, you can follow this list of commands:

```sh
$ cd sema
$ npm install
$ npm run build
$ npm run dev
```

If you decide to go with the Yarn package manager instead, you can use the following list of commands:


To use Yarn:
```sh
$ cd sema
$ yarn
$ yarn build
$ yarn dev
```

Once you have sema running as a node application, you can load it on your browser on the following ports
- npm run dev, go to [http://localhost:5000](http://localhost:5000) on your browser


## Hardware acceleration:

Hardware acceleration will have a drastic effect in Tensorflow.js model training speed.

To enable it in Chrome:
* Navigate to chrome://settings
* Click the **Advanced ▼** button at the bottom of the page
* In the **System** section, ensure the **Use hardware acceleration when available** checkbox is checked (relaunch Chrome for changes to take effect)

To enable in Firefox:
- Go to `about:preferences`
- Scroll till you reach the **Performance section**, or simply search for "performance"
- Enable **recommended performance settings**, this will enable hardware acceleration if and when it is available

## Linux Users

Sema uses Web Audio API Audio Worklets. Their performance seems very sensitive to CPU power scaling. If you are experiencing sound quality issues, try setting the CPU governor to *performance* mode. e.g on Ubuntu,

```$ cpupower frequency-set --governor performance```


## Documentation

Sema's _internal documentation_ aims at supporting the users learning experience. It is integrated within the application and comprises the following sections:

* [Getting started](assets/docs/getting-started)

* [Playground](assets/docs/playground)

* [Live Coding](assets/docs/live-coding)

* [Machine Learning](assets/docs/machine-learning)

* [Language Creation](assets/docs/language-creation)


Sema's [Wiki](https://github.com/mimic-sussex/sema/wiki) documentation aims at supporting contributions. It focuses on how Sema is designed and built:

* [What is the architecture of Sema?](https://github.com/mimic-sussex/sema/wiki/1.-The-Architecture-of-Sema)

* [How does Sema implement and use web services](https://github.com/mimic-sussex/sema/wiki/How-Sema-implements-and-uses-web-services)

* [How to setup Sema on my own web server?](https://github.com/mimic-sussex/sema/wiki/6.-How-to-setup-Sema-on-my-own-web-server%3F)

* [How do I add a new ML library to Sema?](https://github.com/mimic-sussex/sema/wiki/5.-How-do-I-add-a-new-ML-library-to-Sema%3F)

* [How do I create and add a new widget to Sema?](https://github.com/mimic-sussex/sema/wiki/4.-How-do-I-create-and-add-a-new-widget-to-Sema%3F)

* [How do I add my own documentation to Sema?](https://github.com/mimic-sussex/sema/wiki/How-do-I-add-my-own-documentation-to-Sema%3F)

* [How do the Svelte stores in Sema work?](https://github.com/mimic-sussex/sema/wiki/How-do-the-Svelte-stores-in-Sema-work%3F)

## Contributing

Sema is an open-source project and hopefully the underlying vision, aims and structure will motivate you to contribute to it. Check the following:

* [How do I contribute to Sema?](https://github.com/mimic-sussex/sema/wiki/7.-How-do-I-contribute-to-Sema%3F)

* [CONTRIBUTING.md](https://github.com/mimic-sussex/sema/blob/master/CONTRIBUTING.md)

* [Getting set up for development](https://github.com/mimic-sussex/sema/wiki/Getting-set-up-for-development-with-Sema)

* [Debugging Sema](https://github.com/mimic-sussex/sema/wiki/Debugging-Sema)

* [Design Guide](https://github.com/mimic-sussex/sema/wiki/Design-Guide)


## Publications

Bernardo, F., Kiefer, C., Magnusson, T. (2021). *Assessing the Support for Creativity of a Playground for Live Coding Machine Learning,* In: Baalsrud Hauge J., C. S. Cardoso J., Roque L., Gonzalez-Calero P.A. (eds) Entertainment Computing – ICEC 2021. ICEC 2021. Lecture Notes in Computer Science, vol 13056. Springer, Cham. https://doi.org/10.1007/978-3-030-89394-1_38

Bernardo, F., Kiefer, C., Magnusson, T. (2020). *A Signal Engine for a Live Coding Language Ecosystem,* J. Audio Eng. Soc., vol. 68, no. 10, pp. 756-766. doi: https://doi.org/10.17743/jaes.2020.0016

Bernardo, F., Kiefer, C., Magnusson, T. (2020). *Designing for a Pluralist and User-Friendly Live Code Language Ecosystem with Sema.* 5th International Conference on Live Coding,
University of Limerick, Limerick, Ireland

Bernardo, F., Kiefer, C., Magnusson, T. (2019). [*An AudioWorklet-based Signal Engine for a Live Coding Language Ecosystem.*](https://www.ntnu.edu/documents/1282113268/1290797448/WAC2019-CameraReadySubmission-40.pdf) In Proceedings of Web Audio Conference 2019,
Norwegian University of Science and Technology (NTNU), Trondheim, Norway (Best Paper
Award at Web Audio Conference 2019)



