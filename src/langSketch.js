
let langSketch; export default langSketch = `//Synth
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

'🎙️' << '🎧' << '🎚️' << '🎛️'`;
