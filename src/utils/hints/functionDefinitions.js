export const functionDefinitions = [
    {
        "text": ">",
        "description": "Route a single signal to all outputs, by putting an > at the point in the signal chain where you want to output.",
        "category": "Audio Outputs",
        "links": "the--operator"
    },
    {
        "text": "dac",
        "description": "To change channel numbers programmatically, use the dac function.",
        "category": "Audio Outputs",
        "links": "dac"
    },
    {
        "text": "adc",
        "arguments": "Amplitude",
        "category": "Audio Inputs",
        "links": "audio-input"
    },
    {
        "text": "sin",
        "description": "Sine wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "sin"
    },
    {
        "text": "saw",
        "description": "Saw wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "saw"
    },
    {
        "text": "tri",
        "description": "Triangle wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "tri"
    },
    {
        "text": "pha",
        "description": "Phasor (a ramp that rises from 0 to 1)",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "pha"
    },
    {
        "text": "ph2",
        "description": "Phasor with start and end phase",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "ph2"
    },
    {
        "text": "sqr",
        "description": "Square wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "sqr"
    },
    {
        "text": "pul",
        "description": "Pulse (the second argument is pulsewidth)",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "pul"
    },
    {
        "text": "imp",
        "description": "Impulse (single impulse, useful for triggering)",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "imp"
    },
    {
        "text": "sawn",
        "description": "Anti-aliased saw wave",
        "arguments": "Frequency; Phase",
        "category": "Oscillators",
        "links": "sawn"
    },
    {
        "text": "noiz",
        "description": "White noise",
        "arguments": "Amplitude",
        "category": "Noise",
        "links": "noiz"
    },
    {
        "text": "sah",
        "description": "Sample and hold",
        "arguments": "Input signal; Sampling period length (ms)",
        "category": "Control",
        "links": "sah"
    },
    {
        "text": "env",
        "description": "The envelope is an adsr envelope, so the arguments are \"input signal\".",
        "arguments": "Attack (in ms); Decay (in ms); Sustain level (0-1); Release (in ms).",
        "category": "Envelopes",
        "links": "envelopes"
    },
    {
        "text": "line",
        "description": "Triggered line generator",
        "arguments": "Trigger; Time (ms) to rise from 0 to 1",
        "category": "Envelopes",
        "links": "line"
    },
    {
        "text": "\\",
        "description": "Samples are preloaded when the audio engine starts up. Play a sample once with a trigger, using \\ followed by the sample name.",
        "arguments": "Trigger (positive zero crossing); Speed (1=normal, 2= double, etc); Offset",
        "category": "Sample Playback",
        "links": "the-operator"
    },
    {
        "text": "|",
        "category": "Sample Slicing",
        "links": "the--operator-1"
    },
    {
        "text": "lpf",
        "description": "One pole low pass",
        "arguments": "Input signal; Cutoff (0-1)",
        "category": "Filters",
        "links": "lpf"
    },
    {
        "text": "hpf",
        "description": "One pole high pass",
        "arguments": "Input signal; Cutoff (0-1)",
        "category": "Filters",
        "links": "hpf"
    },
    {
        "text": "lpz",
        "description": "Low pass with resonance",
        "arguments": "Input signal; Cutoff (20-20000); Resonance (1 upwards)",
        "category": "Filters",
        "links": "lpz"
    },
    {
        "text": "hpz",
        "description": "High pass with resonance",
        "arguments": "Input signal; Cutoff (20-20000); Resonance (1 upwards)",
        "category": "Filters",
        "links": "hpz"
    },
    {
        "text": "svf",
        "description": "State variable filter",
        "arguments": "Input signal; Cutoff frequency (Hz); Resonance; Low pass filter amount (0-1); Band pass filter amount(0-1); High pass filter amount (0-1); Notch filter amount (0-1",
        "category": "Filters",
        "links": "svf"
    },
    {
        "text": "dist",
        "description": "Distortion",
        "arguments": "Input; Shape: from 1 (soft clipping) to infinity (hard clipping) atan distortion",
        "category": "Effects",
        "links": "dist"
    },
    {
        "text": "asymclip",
        "description": "Asymmetric wave shaping",
        "arguments": "Input signal; The curve shape for values below zero (e.g. 2 = squared, 3 = cubed, 0.5 = square root); The curve shape for values above zero",
        "category": "Effects",
        "links": "asymclip"
    },
    {
        "text": "flange",
        "description": "Flanger",
        "arguments": "Input signal; Delay = delay time (ms); Feedback = 0 - 1; Speed = lfo speed in Hz; Depth = 0 - 1",
        "category": "Effects",
        "links": "flange"
    },
    {
        "text": "chor",
        "description": "Chorus",
        "arguments": "Input signal; Delay = delay time (ms); Feedback = 0 - 1; Speed = lfo speed in Hz; Depth = 0 - 2",
        "category": "Effects",
        "links": "chor"
    },
    {
        "text": "dl",
        "description": "Delay line",
        "arguments": "Input signal; Delay time in samples; Amount of feedback (between 0 and 1)",
        "category": "Effects",
        "links": "dl"
    },
    {
        "text": "freeverb",
        "description": "Reverb",
        "arguments": "Input signal; Room size (0-1); Absorption (0-1)",
        "category": "Effects",
        "links": "freeverb"
    },
    {
        "text": "gt",
        "description": "Greater than",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "lt",
        "description": "Less than",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "mod",
        "description": "Modulo",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "add",
        "description": "Add",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "mul",
        "description": "Multiply",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "sub",
        "description": "Subtract",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "div",
        "description": "Divide",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "pow",
        "description": "Power of",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "abs",
        "description": "Absolute value",
        "category": "Operators",
        "links": "operators"
    },
    {
        "text": "blin",
        "description": "bipolar linear map from range -1,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values"
    },
    {
        "text": "ulin",
        "description": "unipolar linear map from range 0,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values"
    },
    {
        "text": "bexp",
        "description": "bipolar exponential map from range -1,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values"
    },
    {
        "text": "uexp",
        "description": "unipolar exponential map from range 0,1 to range between arg 2 and arg 3",
        "arguments": "Input signal; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values"
    },
    {
        "text": "linlin",
        "description": "arbitrary linear map from range between arg 2 and 3, to range between arg 4 and arg 5",
        "arguments": "Input signal; Lower bound of source range; Upper bound of source range; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values"
    },
    {
        "text": "linexp",
        "description": "arbitrary exponential map from range between arg 2 and 3, to range between arg 4 and arg 5",
        "arguments": "Input signal; Lower bound of source range; Upper bound of source range; Lower bound of destination range; Upper bound of destination range",
        "category": "Mapping Values",
        "links": "mapping-values"
    },
    {
        "text": "fft",
        "description": "Fast fourier transform",
        "arguments": "A signal; The number of bins; Hop size, as a percentage of the FFT period",
        "category": "Machine Listening",
        "outputs": "A trigger signal, which triggers every time the FFT updates; An array of frequency strengths (same size as the number of bins); An array of phases (same size as the number of bins)",
        "links": "fft"
    },
    {
        "text": "onzx",
        "description": "Positive zero-crossing detection",
        "arguments": "A signal",
        "category": "Triggers",
        "links": "onzx"
    },
    {
        "text": "onchange",
        "description": "Create a trigger when a change occurs in the input signal",
        "arguments": "A signal; Tolerance (a trigger will be generated if the change is more than +/- this value)",
        "category": "Triggers",
        "links": "onchange"
    },
    {
        "text": "count",
        "description": "Counts up when receiving a trigger",
        "arguments": "Input trigger; Reset trigger",
        "category": "Triggers",
        "links": "count"
    },
    {
        "text": "idx",
        "description": "Index into a list",
        "arguments": "Trigger input - output a value when triggered; The index of the value to be output when a trigger is received (normalised to between 0 and 1); A list of values",
        "category": "Triggers",
        "links": "idx"
    },
    {
        "text": "quantise",
        "description": "When you evaluate your code, choose whether to bring it in on a new bar or immediately",
        "arguments": "On (1) or off (0)",
        "category": "Sequencing",
        "links": "quantise"
    },
    {
        "text": "clk",
        "description": "Set the clock",
        "arguments": "bpm; number of beats in a bar",
        "category": "Sequencing",
        "links": "clk"
    },
    {
        "text": "clp",
        "description": "Clock phasor, rises from 0 to 1 each period",
        "arguments": "Rise time, in multiples of the bar length; Phase offset (0 - 1)",
        "category": "Sequencing",
        "links": "sequencing"
    },
    {
        "text": "clt",
        "description": "Clock trigger. This generates a trigger every period.",
        "arguments": "Time between triggers, in multiples of bar length; Phase offset (0 - 1)",
        "category": "Sequencing",
        "links": "clt"
    },
    {
        "text": "rsq",
        "description": "Ratio sequencer",
        "arguments": "A phasor; An array of time ratios. The phasor period is divided into these ratios, and a trigger is emitted at the beginning or each division; (optional) An array of values. At the start of each time division, a value is read from the list. Successive values are read, in a loop.",
        "category": "Sequencing",
        "links": "rsq"
    },
    {
        "text": "const",
        "description": "Assign a value directy to a variable",
        "category": "Data",
        "links": "const"
    },
    {
        "text": "poll",
        "description": "Send a value to the javascript console, once per second",
        "category": "Data",
        "links": "poll"
    }
]