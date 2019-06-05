let langSketch;
export default langSketch = `

osc tri 100 + osc sin 101.4


// Start web audio graph
start;

//Beat
ko c ko

nearley-test ./eppprocessor.js --input 'osc tri (osc sin (osc sin (osc square (osc phasor 12 + osc saw 12))))'

osc tri (osc sin (osc sin (osc square (osc phasor 12 + osc saw 12))))

//Loop
[ko c ko];

// Synth def
this.osc.sinewave(60);

tpb 12;

k oock s co;

[kc  kc  s];

∞ ∆ 12;

∞ ∆ (∞ ~ 12 + ∞ ◊ 1 );



//Osc definition
osc sin 0.5 3.4

//Sauron Synth: synth assignment to agent
☺sauron <- osc(∆, 1.0, 1.34).osc(~, 1.0, 1.04).osc(Ø, osc(∞, bus(0, 440), 1.04)+osc(≈, 66, bus(1,1.30)))

## REPL step

☺sauron <- osc(∆, 1.0, 1.34).osc(~, 1.0, bus(0, 1.04)).osc(Ø, osc(∞, bus(0, 440), 1.04)+osc(≈, 66, bus(1,1.30)))

bus(0, 440)

## NOTE: Audio engine objects
## busdata = {value:0, written:false}
## buses = []

☺sauron2 <- ☺sauron.osc(∆, 1.0, 1.34).osc(∆, 1.0, 1.34)

//Gandalfs'beat
☻gandalf <- [.0x.0-x.0-x.-0x-.-]

☺sauron << ☻gandalf

∞(∆, 1.0, 1.5).∞(~, 1.0. 1.04).∞(∞(∞, 440, 1.04)+∞(≈, 66, 1.30))

☺sauron = {
  f : [@osc: (∆, 1.0, 1.34)
       	[@osc: (~, 1.0, 1.04)
          [@osc(Ø,
            [@osc(∞,
           [()=> (bus1 || 440), 1.04]
           +
           osc(≈, 66, 1.30))
          ]
         ]
       ]

# Indexed access to the tree with .dot notation
☺sauron.f[@osc]

☺sauron << '🎹'

fx << '🎙️'

'🎙️' << '🎧' << '🎚️' << '🎛️'

// maxiMap (static method)

maxiOsc osc1, osc2, osc3, osc4, osc5;
maxiFilter filt1;
maxiDistortion dist;
maxiBiquad biquad;

void setup() {//some inits
//    biquad.set(maxiBiquad::PEAK, 800, 0.1,-10);
}

void play(double *output) {
    double ramp = osc4.phasor(0.1) * 20.0;
    double freq = maxiMap::linexp(osc2.sinewave(ramp + 0.1),-1,1,50,200);
    double w = osc1.sawn(freq) + osc3.sawn(freq*1.03);
    w = filt1.lores(w, maxiMap::linexp(osc5.phasor(0.4),0,1,40,4000), 0.9);
//    w = biquad.play(w);
    w = dist.atanDist(w,10);
    output[0]= output[1] = w;
}
`;
