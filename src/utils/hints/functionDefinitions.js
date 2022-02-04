export const functionDefinitions = [
    {
        "text": ">",
        "description": "Route a single signal to all outputs, by putting an > at the point in the signal chain where you want to output.",
        "category": "Audio Outputs",
        "links": "the--operator",
        "linksCategory": "audio-outputs"
    },
    {
        "text": "dac",
        "description": "To change channel numbers programmatically, use the dac function.",
        "category": "Audio Outputs",
        "links": "dac",
        "linksCategory": "audio-outputs"
    },
    {
        "text": "adc",
        "arguments": "Amplitude",
        "category": "Audio Input",
        "links": "audio-input",
        "linksCategory": "audio-input"
    },
    {
        "text": "sin",
        "description": "Sine wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "sin",
        "linksCategory": "oscillators"
    },
    {
        "text": "saw",
        "description": "Saw wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "saw",
        "linksCategory": "oscillators"
    },
    {
        "text": "tri",
        "description": "Triangle wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "tri",
        "linksCategory": "oscillators"
    },
    {
        "text": "pha",
        "description": "Phasor (a ramp that rises from 0 to 1)",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "pha",
        "linksCategory": "oscillators"
    },
    {
        "text": "ph2",
        "description": "Phasor with start and end phase",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "ph2",
        "linksCategory": "oscillators"
    },
    {
        "text": "sqr",
        "description": "Square wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "sqr",
        "linksCategory": "oscillators"
    },
    {
        "text": "pul",
        "description": "Pulse (the second argument is pulsewidth)",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "pul",
        "linksCategory": "oscillators"
    },
    {
        "text": "imp",
        "description": "Impulse (single impulse, useful for triggering)",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "imp",
        "linksCategory": "oscillators"
    },
    {
        "text": "sawn",
        "description": "Anti-aliased saw wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "sawn",
        "linksCategory": "oscillators"
    },
    {
        "text": "noiz",
        "description": "White noise",
        "arguments": "Amplitude",
        "category": "Oscillators",
        "links": "noiz",
        "linksCategory": "oscillators"
    },



    {
        "text": "sinb",
        "description": "PolyBLEP sine",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "sinb",
        "linksCategory": "oscillators"
    },
    {
        "text": "cosb",
        "description": "PolyBLEP cosine",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "cosb",
        "linksCategory": "oscillators"
    },
    {
        "text": "trib",
        "description": "PolyBLEP triangle",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "trib",
        "linksCategory": "oscillators"
    },
    {
        "text": "sqrb",
        "description": "PolyBLEP sqaure",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "sqrb",
        "linksCategory": "oscillators"
    },
    {
        "text": "rectb",
        "description": "PolyBLEP rectangle",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "rectb",
        "linksCategory": "oscillators"
    },
    {
        "text": "sawb",
        "description": "PolyBLEP saw",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "sawb",
        "linksCategory": "oscillators"
    },
    {
        "text": "rampb",
        "description": "PolyBLEP ramp",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "rampb",
        "linksCategory": "oscillators"
    },
    {
        "text": "modtrib",
        "description": "PolyBLEP modified triangle",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "modtrib",
        "linksCategory": "oscillators"
    },
    {
        "text": "modsqrb",
        "description": "PolyBLEP modified square",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "modsqrb",
        "linksCategory": "oscillators"
    },
    {
        "text": "hrecsinb",
        "description": "PolyBLEP half-rectified sine",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "hrecsinb",
        "linksCategory": "oscillators"
    },
    {
        "text": "frecsinb",
        "description": "PolyBLEP fully rectified sine",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "frecsinb",
        "linksCategory": "oscillators"
    },
    {
        "text": "tripulb",
        "description": "PolyBLEP triangle-pulse",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "tripulb",
        "linksCategory": "oscillators"
    },
    {
        "text": "trapb",
        "description": "PolyBLEP fixed trapezoid",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "trapb",
        "linksCategory": "oscillators"
    },
    {
        "text": "vtrapb",
        "description": "PolyBLEP variable trapezoid",
        "arguments": "Frequency; Pulse Width (0 to 1) (optional)",
        "category": "Oscillators",
        "links": "vtrapb",
        "linksCategory": "oscillators"
    },
    {
        "text": "polyblep",
        "description": "PolyBLEP modulatable waveform function. The waveform parameter options correspond to the other PolyBLEP oscillators. Full list in documentation.",
        "arguments": "Frequency; Waveform (0-13); Pulse width (optional))",
        "category": "Oscillators",
        "links": "sinb",
        "linksCategory": "oscillators"
    },
    {
        "text": "sah",
        "description": "Sample and hold",
        "arguments": "Input signal; Sampling period length (ms)",
        "category": "Control",
        "links": "sah",
        "linksCategory": "control"
    },
    {
        "text": "env",
        "description": "The envelope is an adsr envelope, so the arguments are \"input signal\".",
        "arguments": "Attack (in ms); Decay (in ms); Sustain level (0-1); Release (in ms).",
        "category": "Envelopes",
        "links": "envelopes",
        "linksCategory": "envelopes"
    },
    {
        "text": "line",
        "description": "Triggered line generator",
        "arguments": "Trigger; Time (ms) to rise from 0 to 1",
        "category": "Envelopes",
        "links": "line",
        "linksCategory": "envelopes"
    },
    {
        "text": "\\",
        "description": "Samples are preloaded when the audio engine starts up. Play a sample once with a trigger, using \\ followed by the sample name.",
        "arguments": "Trigger (positive zero crossing); Speed (1=normal, 2= double, etc); Offset",
        "category": "Sample Playback",
        "links": "the-operator",
        "linksCategory": "sample-playback"
    },
    {
        "text": "|",
        "description": "Used for slicing up samples.",
        "category": "Sample Slicing",
        "links": "the--operator-1",
        "linksCategory": "sample-slicing"
    },
    {
        "text": "lpf",
        "description": "One pole low pass",
        "arguments": "Input signal; Cutoff (0-1)",
        "category": "Filters",
        "links": "lpf",
        "linksCategory": "filters"
    },
    {
        "text": "hpf",
        "description": "One pole high pass",
        "arguments": "Input signal; Cutoff (0-1)",
        "category": "Filters",
        "links": "hpf",
        "linksCategory": "filters"
    },
    {
        "text": "lpz",
        "description": "Low pass with resonance",
        "arguments": "Input signal; Cutoff (20-20000); Resonance (1 upwards)",
        "category": "Filters",
        "links": "lpz",
        "linksCategory": "filters"
    },
    {
        "text": "hpz",
        "description": "High pass with resonance",
        "arguments": "Input signal; Cutoff (20-20000); Resonance (1 upwards)",
        "category": "Filters",
        "links": "hpz",
        "linksCategory": "filters"
    },
    {
        "text": "svf",
        "description": "State variable filter",
        "arguments": "Input signal; Cutoff frequency (Hz); Resonance; Low pass filter amount (0-1); Band pass filter amount(0-1); High pass filter amount (0-1); Notch filter amount (0-1",
        "category": "Filters",
        "links": "svf",
        "linksCategory": "filters"
    },
    {
        "text": "dist",
        "description": "Distortion",
        "arguments": "Input; Shape: from 1 (soft clipping) to infinity (hard clipping) atan distortion",
        "category": "Effects",
        "links": "dist",
        "linksCategory": "effects"
    },
    {
        "text": "asymclip",
        "description": "Asymmetric wave shaping",
        "arguments": "Input signal; The curve shape for values below zero (e.g. 2 = squared, 3 = cubed, 0.5 = square root); The curve shape for values above zero",
        "category": "Effects",
        "links": "asymclip",
        "linksCategory": "effects"
    },
    {
        "text": "flange",
        "description": "Flanger",
        "arguments": "Input signal; Delay = delay time (ms); Feedback = 0 - 1; Speed = lfo speed in Hz; Depth = 0 - 1",
        "category": "Effects",
        "links": "flange",
        "linksCategory": "effects"
    },
    {
        "text": "chor",
        "description": "Chorus",
        "arguments": "Input signal; Delay = delay time (ms); Feedback = 0 - 1; Speed = lfo speed in Hz; Depth = 0 - 2",
        "category": "Effects",
        "links": "chor",
        "linksCategory": "effects"
    },
    {
        "text": "dl",
        "description": "Delay line",
        "arguments": "Input signal; Delay time in samples; Amount of feedback (between 0 and 1)",
        "category": "Effects",
        "links": "dl",
        "linksCategory": "effects"
    },
    {
        "text": "freeverb",
        "description": "Reverb",
        "arguments": "Input signal; Room size (0-1); Absorption (0-1)",
        "category": "Effects",
        "links": "freeverb",
        "linksCategory": "effects"
    },
    {
        "text": "gt",
        "description": "Greater than",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "lt",
        "description": "Less than",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "mod",
        "description": "Modulo",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "add",
        "description": "Add",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "mul",
        "description": "Multiply",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "sub",
        "description": "Subtract",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "div",
        "description": "Divide",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "pow",
        "description": "Power of",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "abs",
        "description": "Absolute value",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "sum",
        "description": "Sum of",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "mix",
        "description": "Mix together. Sum and divide by length.",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "prod",
        "description": "Product. Multiply together.",
        "category": "Operators",
        "links": "operators",
        "linksCategory": "operators"
    },
    {
        "text": "blin",
        "description": "bipolar linear map from range -1,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values",
        "linksCategory": "mapping-values"
        
    },
    {
        "text": "ulin",
        "description": "unipolar linear map from range 0,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values",
        "linksCategory": "mapping-values"
    },
    {
        "text": "bexp",
        "description": "bipolar exponential map from range -1,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values",
        "linksCategory": "mapping-values"
    },
    {
        "text": "uexp",
        "description": "unipolar exponential map from range 0,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values",
        "linksCategory": "mapping-values"
    },
    {
        "text": "linlin",
        "description": "arbitrary linear map from range between arg 2 and 3, to range between arg 4 and arg 5",
        "arguments": "Input signal; Lower bound of source range; Upper bound of source range; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values",
        "linksCategory": "mapping-values"
    },
    {
        "text": "linexp",
        "description": "arbitrary exponential map from range between arg 2 and 3, to range between arg 4 and arg 5",
        "arguments": "Input signal; Lower bound of source range; Upper bound of source range; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values",
        "linksCategory": "mapping-values"
    },

    {
        "text": "\[",
        "description": "Some functions have lists as arguments, or return lists. Lists are enclosed in square brackets, and contain signals, separated by commas",
        "arguments": "Signal; ...; Signal;",
        "category": "Lists",
        "links": "lists",
        "linksCategory": "lists"
    },
    {
        "text": "\]",
        "description": "Some functions have lists as arguments, or return lists. Lists are enclosed in square brackets, and contain signals, separated by commas",
        "arguments": "Signal; ...; Signal;",
        "category": "Lists",
        "links": "lists",
        "linksCategory": "lists"
    },
    {
        "text": "toJS",
        "description": "Send data to the JS window.",
        "arguments": "Frequency of transfer; Channel to send on, Signal to send",
        "category": "Communication with the JS Window",
        "links": "communication-with-the-js-window",
        "linksCategory": "communication-with-the-js-window"
    },
    {
        "text": "fromJS",
        "description": "Recieve data from the JS window.",
        "arguments": "Channel to recieve on",
        "category": "Communication with the JS Window",
        "links": "communication-with-the-js-window",
        "linksCategory": "communication-with-the-js-window"
    },
    {
        "text": "mouseX",
        "description": "Get X coordinates of the mouse",
        "category":"Mouse Input",
        "links": "mouse-input",
        "linksCategory": "mouse-input"
    },
    {
        "text": "mouseY",
        "description": "Get Y coordinates of the mouse",
        "category":"Mouse Input",
        "links": "mouse-input",
        "linksCategory": "mouse-input"
    },
    {
        "text": "fft",
        "description": "Fast fourier transform",
        "arguments": "A signal; The number of bins; Hop size, as a percentage of the FFT period",
        "category": "Machine Listening",
        "outputs": "A trigger signal, which triggers every time the FFT updates; An array of frequency strengths (same size as the number of bins); An array of phases (same size as the number of bins)",
        "links": "fft",
        "linksCategory": "machine-listening"
    },
    {
        "text": "onzx",
        "description": "Positive zero-crossing detection",
        "arguments": "A signal",
        "category": "Triggers",
        "links": "onzx",
        "linksCategory": "triggers"
    },
    {
        "text": "onchange",
        "description": "Create a trigger when a change occurs in the input signal",
        "arguments": "A signal; Tolerance (a trigger will be generated if the change is more than +/- this value)",
        "category": "Triggers",
        "links": "onchange",
        "linksCategory": "triggers"
    },
    {
        "text": "count",
        "description": "Counts up when receiving a trigger",
        "arguments": "Input trigger; Reset trigger",
        "category": "Triggers",
        "links": "count",
        "linksCategory": "triggers"
    },
    {
        "text": "idx",
        "description": "Index into a list",
        "arguments": "Trigger input - output a value when triggered; The index of the value to be output when a trigger is received (normalised to between 0 and 1); A list of values",
        "category": "Triggers",
        "links": "idx",
        "linksCategory": "triggers"
    },
    {
        "text": "quantise",
        "description": "When you evaluate your code, choose whether to bring it in on a new bar or immediately",
        "arguments": "On (1) or off (0)",
        "category": "Sequencing",
        "links": "quantise",
        "linksCategory": "sequencing"
    },
    {
        "text": "clk",
        "description": "Set the clock",
        "arguments": "bpm; number of beats in a bar",
        "category": "Sequencing",
        "links": "clk",
        "linksCategory": "sequencing"
    },
    {
        "text": "clp",
        "description": "Clock phasor, rises from 0 to 1 each period",
        "arguments": "Rise time, in multiples of the bar length; Phase offset (0 - 1)",
        "category": "Sequencing",
        "links": "clp",
        "linksCategory": "sequencing"
    },
    {
        "text": "clt",
        "description": "Clock trigger. This generates a trigger every period.",
        "arguments": "Time between triggers, in multiples of bar length; Phase offset (0 - 1)",
        "category": "Sequencing",
        "links": "clt",
        "linksCategory": "sequencing"
    },
    {
        "text": "rsq",
        "description": "Ratio sequencer",
        "arguments": "A phasor; An array of time ratios. The phasor period is divided into these ratios, and a trigger is emitted at the beginning or each division; (optional) An array of values. At the start of each time division, a value is read from the list. Successive values are read, in a loop.",
        "category": "Sequencing",
        "links": "rsq",
        "linksCategory": "sequencing"
    },
    {
        "text": "const",
        "description": "Assign a value directy to a variable",
        "category": "Data",
        "links": "const",
        "linksCategory": "data"
    },
    {
        "text": "poll",
        "description": "Send a value to the javascript console, once per second",
        "category": "Debugging",
        "links": "poll",
        "linksCategory": "debugging"
    }
]