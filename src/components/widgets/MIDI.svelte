<script>
  import {
    onMount,
    onDestroy
  } from 'svelte';

  import WebMidi from 'webmidi';

  const subscribeEvents = input => {

    input.addListener('pitchbend', "all", function(e) {
      console.log("Pitch value: " + e.value);
    });

    // Listen for a 'note on' message on all channels
    input.addListener('noteon',
      "all",
      e => console.log("Received 'noteon' message (" + e.note.name + e.note.octave + ")." )
    );

    // Listen to pitch bend message on channel 3
    input.addListener('pitchbend',
      3,
      e => console.log("Received 'pitchbend' message.", e)
    );

    // Listen to control change message on all channels
    input.addListener('controlchange',
      "all",
      e => console.log("Received 'controlchange' message.", e)
    );

    // Listen to NRPN message on all channels
    input.addListener('nrpn', "all",
      e => {
        if(e.controller.type === 'entry') {
          console.log("Received 'nrpn' 'entry' message.", e);
        }
        if(e.controller.type === 'decrement') {
          console.log("Received 'nrpn' 'decrement' message.", e);
        }
        if(e.controller.type === 'increment') {
          console.log("Received 'nrpn' 'increment' message.", e);
        }
        console.log("message value: " + e.controller.value + ".", e);
      }
    );

    input.addListener('programchange',
      "12",
      e => console.log("Received 'programchange' message.", e)
    );
  }
  onMount( async () => {

    WebMidi.enable( err => {
      if(err)
        console.log("WebMidi could not be enabled.", err);
      else {
        console.log("WebMidi enabled!");
        WebMidi.inputs.map(i => console.log(i.name))
        WebMidi.outputs.map(o => console.log(o.name))

        // let input = WebMidi.getInputByName("Axiom Pro 25 USB A In");
        let input_xtone = WebMidi.getInputByName("XTONE");
        let input_mio = WebMidi.getInputByName("mio");
        if(input_xtone) subscribeEvents(input_xtone);
        if(input_mio) subscribeEvents(input_mio);
      };
  });

  });

</script>