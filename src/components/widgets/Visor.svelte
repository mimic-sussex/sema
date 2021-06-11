<script>

  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  import { items } from '../../stores/playground.js'

  var data = [30, 86, 168, 281, 303, 365];
  let el;

const N_DIMS = 90;
// The sorted 256 dimensions, from most to least important.
// I got this by sorting the average sigmas for each dimension, after encoding
// a large dataset into MusicVAE. Note that these dimensions only work for these
// models. A different MusicVAE model will have a different ordering.
const MELODY_DIMS = [
  73,
  135,
  230,
  177,
  38,
  208,
  172,
  56,
  212,
  211,
  140,
  142,
  150,
  1,
  202,
  74,
  33,
  187,
  206,
  14,
  154,
  2,
  31,
  32,
  244,
  24,
  183,
  173,
  64,
  3,
  108,
  196,
  132,
  29,
  75,
  156,
  131,
  26,
  237,
  164,
  200,
  48,
  218,
  44,
  113,
  167,
  250,
  166,
  90,
  77,
  23,
  185,
  246,
  180,
  217,
  10,
  111,
  213,
  46,
  127,
  216,
  117,
  128,
  16,
  222,
  243,
  240,
  233,
  70,
  9,
  88,
  236,
  179,
  40,
  94,
  4,
  182,
  241,
  78,
  165,
  125,
  25,
  103,
  81,
  66,
  83,
  91,
  124,
  105,
  226,
  247,
  145,
  68,
  238,
  69,
  47,
  254,
  153,
  119,
  5,
  255,
  170,
  158,
  176,
  84,
  225,
  186,
  43,
  99,
  245,
  224,
  168,
  45,
  160,
  63,
  49,
  37,
  61,
  35,
  101,
  141,
  41,
  248,
  209,
  134,
  149,
  147,
  30,
  110,
  188,
  118,
  52,
  67,
  133,
  92,
  95,
  126,
  112,
  15,
  93,
  157,
  107,
  55,
  60,
  130,
  235,
  231,
  6,
  123,
  171,
  114,
  20,
  139,
  162,
  199,
  86,
  51,
  120,
  227,
  85,
  152,
  178,
  80,
  184,
  39,
  215,
  22,
  138,
  192,
  57,
  155,
  252,
  198,
  13,
  50,
  181,
  8,
  121,
  148,
  193,
  204,
  36,
  251,
  219,
  0,
  97,
  220,
  229,
  109,
  21,
  194,
  159,
  72,
  122,
  146,
  87,
  42,
  102,
  189,
  65,
  115,
  253,
  19,
  163,
  201,
  207,
  137,
  100,
  27,
  242,
  34,
  203,
  129,
  210,
  11,
  54,
  232,
  12,
  28,
  98,
  71,
  18,
  205,
  17,
  79,
  249,
  197,
  221,
  223,
  234,
  106,
  76,
  175,
  239,
  136,
  53,
  58,
  89,
  191,
  82,
  190,
  59,
  62,
  174,
  214,
  96,
  161,
  195,
  151,
  116,
  143,
  7,
  104,
  169,
  144,
  228,
];
const TRIO_DIMS = [
  132,
  68,
  160,
  36,
  105,
  248,
  75,
  152,
  135,
  18,
  246,
  1,
  77,
  79,
  7,
  163,
  87,
  63,
  72,
  162,
  236,
  0,
  221,
  108,
  29,
  98,
  78,
  203,
  166,
  173,
  69,
  74,
  129,
  125,
  142,
  53,
  8,
  156,
  52,
  85,
  189,
  133,
  206,
  25,
  65,
  94,
  253,
  71,
  233,
  33,
  31,
  176,
  116,
  64,
  131,
  255,
  159,
  83,
  35,
  195,
  214,
  139,
  127,
  134,
  86,
  70,
  165,
  177,
  194,
  137,
  187,
  113,
  190,
  37,
  161,
  58,
  151,
  81,
  210,
  183,
  62,
  179,
  218,
  254,
  230,
  27,
  222,
  115,
  73,
  192,
  112,
  175,
  145,
  3,
  229,
  217,
  251,
  169,
  90,
  167,
  11,
  186,
  120,
  242,
  208,
  17,
  150,
  92,
  215,
  191,
  209,
  184,
  46,
  34,
  188,
  51,
  60,
  171,
  12,
  24,
  250,
  16,
  38,
  104,
  172,
  117,
  128,
  50,
  212,
  114,
  95,
  21,
  2,
  158,
  96,
  136,
  147,
  252,
  126,
  47,
  43,
  30,
  19,
  84,
  91,
  205,
  42,
  196,
  234,
  243,
  146,
  149,
  13,
  226,
  225,
  157,
  22,
  219,
  138,
  28,
  103,
  14,
  101,
  124,
  200,
  76,
  174,
  182,
  238,
  202,
  100,
  239,
  198,
  130,
  141,
  97,
  66,
  44,
  56,
  9,
  123,
  61,
  231,
  223,
  244,
  111,
  247,
  45,
  153,
  67,
  232,
  109,
  41,
  143,
  201,
  119,
  5,
  185,
  154,
  4,
  170,
  249,
  99,
  55,
  15,
  39,
  26,
  245,
  197,
  168,
  106,
  121,
  6,
  204,
  213,
  155,
  23,
  49,
  118,
  227,
  57,
  88,
  80,
  199,
  211,
  48,
  82,
  240,
  144,
  107,
  89,
  178,
  216,
  20,
  148,
  237,
  207,
  235,
  224,
  228,
  180,
  110,
  193,
  54,
  181,
  140,
  241,
  93,
  59,
  102,
  220,
  32,
  10,
  164,
  40,
  122,
];
const MELODY_BARS = 2;
const TRIO_BARS = 4;

let isMelodyMode = true;
let SORTED_DIMS, MODEL_BARS;

// Models.
let mvae;
let midime;

// Soundfont players.
let playerInput, playerSample, playerMelody;

// MIDI Visualizers.
let vizInput, vizMelody, vizSample;

// The melodies for each of the players/visualizer pairs.
let input, melody, currentSample;
let playerSaidStop = false; // So that we can loop.

let training = {},
    container,
    fileBtn,
    sampleBtn,
    urlBtn,
    urlInput,
    saveBtn,
    btnPlayInput,
    btnPlayMelody,
    btnPlaySample,
    btnSample,
    btnTrain,
    window,
    mvaeSliders,
    midimeSliders,
    fileInput,
    trainingStep,
    trainingSteps,
    totalSteps;




function init() {
  fileBtn.addEventListener("change", loadFile);
  sampleBtn.addEventListener("click", loadSample);
  urlBtn.addEventListener("click", loadURL);
  saveBtn.addEventListener("click", () =>
    saveAs(
      new File([mm.sequenceProtoToMidi(currentSample)], "midime_sample.mid")
    )
  );

  btnPlayInput.addEventListener("click", (e) => play(e, 0));
  btnPlayMelody.addEventListener("click", (e) => play(e, 1));
  btnPlaySample.addEventListener("click", (e) => play(e, 2));
  btnSample.addEventListener("click", sample);
  btnTrain.addEventListener("click", train);
  container.addEventListener("resize", onResize);

  mvaeSliders.addEventListener("change", updateFromFullSliders);
  midimeSliders.addEventListener("change", updateFromMidimeSliders);

  ready(true);
}

function ready(mode) {
  isMelodyMode = mode;
  SORTED_DIMS = isMelodyMode ? MELODY_DIMS : TRIO_DIMS;
  MODEL_BARS = isMelodyMode ? MELODY_BARS : TRIO_BARS;
  updateCopy();

  // splashScreen.hidden = true;
  mainScreen.hidden = false;
  updateUI("model-loading");

  // const url =
  //   "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/" +
  //   (isMelodyMode ? "mel_2bar_small" : "trio_4bar");

  // mvae = new mm.MusicVAE(url);
  // mvae.initialize().then(() => {
  //   updateUI("model-loaded");
  // });

  // sample();
  updateUI("model-loaded");

  // playerInput = new mm.SoundFontPlayer(
  //   "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
  // );
  // playerMelody = new mm.SoundFontPlayer(
  //   "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
  // );
  // playerSample = new mm.SoundFontPlayer(
  //   "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
  // );

  // playerInput.callbackObject = {
  //   run: (note) => vizInput.redraw(note, true),
  //   stop: () => {},
  // };
  // playerMelody.callbackObject = {
  //   run: (note) => vizMelody.redraw(note, true),
  //   stop: () => {},
  // };
  // playerSample.callbackObject = {
  //   run: (note) => vizSample.redraw(note, true),
  //   stop: () => {},
  // };

  for (let i = 0; i < N_DIMS; i++) {
    const div = document.createElement("div");
    div.classList.add("rangeWrap");
    div.innerHTML = `<input type="range" data-index=${i} min="-2" max="2" step="0.1" value="0">`;
    mvaeSliders.appendChild(div);
  }
}

// Loads a file from the user.
function loadFile() {
  updateUI("file-loading");

  midime = new mm.MidiMe({ epochs: 100 });
  midime.initialize();

  const promises = [];
  for (let i = 0; i < fileInput.files.length; i++) {
    promises.push(mm.blobToNoteSequence(fileInput.files[i]));
  }
  Promise.all(promises).then(showInput);
}

// Loads an example if you don't have a file.
function loadSample() {
  updateUI("file-loading");

  midime = new mm.MidiMe({ epochs: 100 });
  midime.initialize();

  const url = isMelodyMode
    ? "https://cdn.glitch.com/d18fef17-09a1-41f5-a5ff-63a80674b090%2Fmel_input.mid?v=1564186536933"
    : "https://cdn.glitch.com/d18fef17-09a1-41f5-a5ff-63a80674b090%2Ftrios_input.mid?v=1564186506192";
  //const url = 'https://cdn.glitch.com/d18fef17-09a1-41f5-a5ff-63a80674b090%2Fchpn_op10_e01_format0.mid?1556142864200';
  mm.urlToNoteSequence(url).then((mel) => {
    showInput([mel]);
  });
}

function loadURL() {
  updateUI("file-loading");

  midime = new mm.MidiMe({ epochs: 100 });
  midime.initialize();

  // Oops, urlToNoteSequence doesn't reject correctly,
  // so do this by hand for now.
  mm.urlToBlob(urlInput.value).then((blob) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        showInput([mm.midiToSequenceProto(reader.result)]);
      } catch (err) {
        updateUI("file-error");
      }
    };
    reader.readAsBinaryString(blob);
  });
}

async function showInput(ns) {
  const instruments = [];
  let shouldSplit = false;
  ns.forEach((m) => {
    const i = getInstruments(m);
    instruments.push(i);
    if (i.length > 1) shouldSplit = true;
  });

  const mels = [];
  const quantizedMels = [];

  if (isMelodyMode && shouldSplit) {
    instruments.forEach((i) => mels.push(getMelody(i)));
    mels.forEach((m) =>
      quantizedMels.push(mm.sequences.quantizeNoteSequence(m, 4))
    );

    trimSilence(mels);
    melody = mm.sequences.concatenate(mels);
    playerMelody.loadSamples(melody);
    vizMelody = new mm.PianoRollSVGVisualizer(
      melody,
      document.getElementById("vizMelody"),
      { noteRGB: "35,70,90", activeNoteRGB: "157, 229, 184", noteHeight: 3 }
    );
    updateUI("has-melody");
  } else {
    ns.forEach((m) =>
      quantizedMels.push(mm.sequences.quantizeNoteSequence(m, 4))
    );
  }

  trimSilence(ns);
  input = mm.sequences.concatenate(ns);
  playerInput.loadSamples(input);
  vizInput = new mm.PianoRollSVGVisualizer(
    input,
    document.getElementById("vizInput"),
    { noteRGB: "35,70,90", activeNoteRGB: "157, 229, 184", noteHeight: 3 }
  );

  // This is the input that we're going to train on.
  const chunks = getChunks(quantizedMels);
  const z = await mvae.encode(chunks); // shape of z is [chunks, 256]

  updateUI("file-loaded");

  training.z = z;
  await sample();

  function getChunks(quantizedMels) {
    // Encode the input into MusicVAE, get back a z.
    // Split this sequence into 32 bar chunks.
    let chunks = [];
    quantizedMels.forEach((m) => {
      const melChunks = mm.sequences.split(
        mm.sequences.clone(m),
        16 * MODEL_BARS
      );
      chunks = chunks.concat(melChunks);
    });
    return chunks;
  }
}

// Get a new random sample.
async function sample() {
  // stopPlayer(playerSample, document.getElementById("btnPlaySample"));
  stopPlayer(playerSample, btnPlaySample);

  let zArray;
  if (midime && midime.trained) {
    // If we've trained, then we sample from MidiMe.
    // const s = await midime.sample(1);
    // zArray = s.arraySync()[0];
    // currentSample = (await mvae.decode(s))[0];

    // // Get the 4 inputs from midime too.
    // const z = midime.encoder.predict(s);
    // const z_ = z[0].arraySync()[0];
    // s.dispose();
    updateMidiMeSliders(z_);
  } else {
    // Get a random sample from music vae. This is basically the
    // code inside mvae.sample(), but since we need the z to
    // display, might as well do it here.
    // const randZs = tf.tidy(() =>
    //   tf.randomNormal([1, mvae.decoder.zDims])
    // );
    // currentSample = (await mvae.decode(randZs, 0.5))[0];
    // zArray = randZs.arraySync()[0];
    // randZs.dispose();
  }

  // zArray = [0.4273136258125305,0.508756160736084,-1.0245095491409302,0.4781806468963623,0.352139949798584,1.328147292137146,1.0396448373794556,-1.2401275634765625,-0.9539296627044678,-0.11884663254022598,-0.0282069593667984,0.43935921788215637,0.5939000844955444,-0.146341472864151,0.8699648976325989,-0.1550857573747635,0.6156570315361023,-0.07236917316913605,-0.17409808933734894,-0.0781342089176178,1.4090230464935303,-0.7335593700408936,-1.7826745510101318,0.8519734740257263,-0.98081374168396,-0.161304771900177,-0.0929071381688118,0.06433915346860886,0.3868505656719208,-1.1012892723083496,-0.6618467569351196,0.37916049361228943,-0.43324556946754456,-0.6808165311813354,1.1546539068222046,2.438314437866211,-0.3340868651866913,0.09898301959037781,-0.9053813219070435,0.9683349132537842,1.048477053642273,0.11628225445747375,0.8169262409210205,-0.07158119976520538,-0.33867695927619934,-0.3780420124530792,0.11963161081075668,0.4075811505317688,-0.4549297094345093,0.6089047789573669,0.9167118668556213,-0.3127461373806,-1.506523847579956,0.5218350887298584,0.57466059923172,0.10076319426298141,0.7022023797035217,0.710063636302948,-1.6883876323699951,-0.2425619512796402,-0.053234074264764786,0.3324764370918274,-1.4605990648269653,0.503839373588562,-2.5747392177581787,-0.0010404839413240552,-0.10897331684827805,0.36928611993789673,0.7973054051399231,0.014698273502290249,2.4695475101470947,-2.858307361602783,0.2961186468601227,-0.018485672771930695,-1.7168099880218506,-1.1406528949737549,0.11973575502634048,-0.22592748701572418,0.30234816670417786,-0.10321353375911713,-0.5349472165107727,-0.0797356367111206,0.7070756554603577,-0.9421660900115967,0.08550292998552322,1.8771655559539795,0.3431217670440674,1.1423758268356323,-0.19685529172420502,-2.579468011856079,0.10358214378356934,0.9544059634208679,0.4434562027454376,-0.5247286558151245,-2.0623114109039307,0.7487368583679199,1.3614579439163208,-0.5423162579536438,1.0650993585586548,-1.964454174041748,0.44294294714927673,1.732566475868225,-0.5355963110923767,-0.6601247787475586,1.055878758430481,-0.1232151985168457,-0.1496375948190689,-0.5792699456214905,-0.010978631675243378,0.6435858607292175,0.004241453483700752,2.0235884189605713,-0.6897674202919006,-0.22850365936756134,1.7147703170776367,1.681538701057434,-0.40218931436538696,-0.8035191893577576,0.46776363253593445,-0.8906765580177307,0.6357719302177429,0.5317249894142151,-0.4416196942329407,0.8056294322013855,-0.8366686701774597,-0.042993124574422836,-0.14108167588710785,-0.043841082602739334,-0.16996711492538452,-2.022756576538086,0.2941383123397827,-0.4187035858631134,1.0234622955322266,-0.4362904131412506,-1.2730262279510498,-1.0925580263137817,-1.0017231702804565,0.4645068645477295,-0.8893401622772217,0.5697357058525085,-2.635570526123047,1.0991755723953247,-1.6946877241134644,-0.2936334013938904,0.05316445231437683,-0.4802614450454712,-1.5925006866455078,0.3917352557182312,-0.1716931313276291,-1.47032630443573,0.12321994453668594,1.8069649934768677,-0.4916571080684662,-0.36869025230407715,1.352461576461792,-1.6487528085708618,-0.16041499376296997,-1.9870870113372803,0.1649920791387558,-0.47956332564353943,1.8736052513122559,-0.08884771168231964,0.4482995867729187,0.5815715789794922,-0.5494769215583801,-0.7606303095817566,-1.9948652982711792,0.6156911253929138,-1.8354082107543945,0.20511214435100555,-0.8284347057342529,0.11351243406534195,-0.5205819606781006,1.9621204137802124,-0.8820695877075195,0.0937398225069046,0.24419063329696655,-1.942501425743103,0.8839418292045593,-1.4687777757644653,1.014916181564331,0.27009207010269165,-0.6406416296958923,-0.16952091455459595,-0.9221426844596863,-0.9337372183799744,-0.0399828739464283,-0.9797290563583374,1.375240445137024,-0.3506052494049072,0.006107899826020002,1.314932107925415,0.9451425075531006,-0.297834575176239,-0.18762236833572388,0.9941446185112,-0.030952073633670807,-0.9814428091049194,-1.0542125701904297,0.9523769021034241,-0.32336458563804626,-0.07506771385669708,-1.1906062364578247,-1.0012887716293335,0.1790892481803894,0.1319727599620819,1.2784156799316406,0.6887288093566895,-0.7360376715660095,0.19377197325229645,0.9721589088439941,1.6620495319366455,0.3763893246650696,-0.9381255507469177,-0.4927753508090973,-1.314428687095642,1.0595526695251465,-0.003196641569957137,-0.78559809923172,-2.5559654235839844,-0.21189932525157928,-1.2260527610778809,-3.4693496227264404,-0.7601618766784668,0.23180826008319855,0.521354079246521,0.6519766449928284,-1.1034760475158691,-0.23621664941310883,-0.2657858729362488,0.6573173999786377,1.296764612197876,1.0834366083145142,-0.3601870834827423,1.2155416011810303,0.1827349215745926,0.3424193859100342,-0.2071567326784134,-0.012644247151911259,-0.7375898361206055,-0.7584282159805298,-0.19697250425815582,-0.11840903013944626,-0.6227549314498901,-0.9998124241828918,-0.5501635670661926,1.1337592601776123,2.0115082263946533,0.4082651436328888,-0.10673908144235611,0.7825223803520203,0.9028396010398865,0.03652779012918472,-1.3463733196258545,0.7250955104827881,-0.8476430177688599];
  zArray = Array.from({length: 256}, () => ( Math.random() * (2.0 - 4.0) + 2.00 ) );
  updateFullSliders(zArray);
  updateVisualizer();
  training.zArray = zArray;
}

function onResize() {
  if (training && training.zArray && training.zArray.length !== 0) {
    plot(training.zArray);
  }
}

// Train the model!!
async function train() {
  updateUI("training");
  stopPlayer(playerMelody, document.getElementById("btnPlayMelody"));

  currentSample = null;
  trainingStep.textContent = 0;
  totalSteps.textContent = midime.config.epochs = parseInt(trainingSteps.value);

  const losses = [];

  await midime.train(training.z, async (epoch, logs) => {
    await mm.tf.nextFrame();
    trainingStep.textContent = epoch + 1;
    losses.push(logs.total);
    plotLoss(losses);
  });
  updateUI("training-done");
  sample();
}

async function play(event, playerIndex) {
  // let player, mel;
  // if (playerIndex === 0) player = playerInput;
  // else if (playerIndex === 1) player = playerMelody;
  // else if (playerIndex === 2) player = playerSample;

  // if (playerIndex === 0) mel = input;
  // else if (playerIndex === 1) mel = melody;
  // else if (playerIndex === 2) mel = currentSample;

  // const btn = event.target;
  // if (player.isPlaying()) {
  //   stopPlayer(player, btn);
  // } else {
  //   startPlayer(player, btn);
  //   player.loadSamples(mel).then(() => loopMelody(player, mel, btn));

  // }
}

function stopPlayer(player, btn) {
  // player.stop();
  playerSaidStop = true;
  btn.querySelector(".iconPlay").removeAttribute("hidden");
  btn.querySelector(".iconStop").setAttribute("hidden", true);
}

function startPlayer(player, btn) {
  playerSaidStop = false;
  btn.querySelector(".iconStop").removeAttribute("hidden");
  btn.querySelector(".iconPlay").setAttribute("hidden", true);


}

function loopMelody(player, mel, btn) {
  player.start(mel).then(() => {
    if (!playerSaidStop) {
      loopMelody(player, mel, btn);
    } else {
      stopPlayer(player, btn);
    }
  });
}

function updateMidiMeSliders(z) {
  const sliders = midimeSliders.querySelectorAll("input");
  for (let i = 0; i < 4; i++) {
    sliders[i].value = z[i];
  }


}

function onSuperSliderChange(){

  console.log("update from sliders");
}

function updateFullSliders(z) {
  // Display the Z in the sliders.
  const sliders = mvaeSliders.querySelectorAll("input");

  if(sliders && sliders.length > 0){
    for (let i = 0; i < N_DIMS; i++) {
      const dim = SORTED_DIMS[i];
      sliders[i].value = z[dim];
    }
  }
  plot(z);

  // playerSample
  //   .loadSamples(currentSample)
  //   .then(() => loopMelody(playerSample, currentSample, null));


  // if (playerIndex === 0) player = playerInput;
  // else if (playerIndex === 1) player = playerMelody;
  // else if (playerIndex === 2) player = playerSample;

  // if (playerIndex === 0) mel = input;
  // else if (playerIndex === 1) mel = melody;
  // else if (playerIndex === 2) mel = currentSample;

}

async function updateFromFullSliders() {
  stopPlayer(playerSample, document.getElementById("btnPlaySample"));

  const z = JSON.parse(JSON.stringify(training.zArray));

  // Update the dimensions displayed for each of the batches.
  const sliders = mvaeSliders.querySelectorAll("input");
  for (let i = 0; i < N_DIMS; i++) {
    const dim = SORTED_DIMS[i];
    z[dim] = parseFloat(sliders[i].value);
  }
  plot(z);

  const zTensor = tf.tensor(z, [1, 256]);
  const ns = await mvae.decode(zTensor);
  currentSample = music_vae.sequences.concatenate(ns);
  updateVisualizer();

  console.log("updateFromFullSliders");

}

async function updateFromMidimeSliders() {
  // stopPlayer(playerSample, document.getElementById("btnPlaySample"));
  let z = [0, 0, 0, 0];

  // Update the dimensions displayed for each of the batches.
  let sliders = midimeSliders.querySelectorAll("input");
  for (let i = 0; i < 4; i++) {
    z[i] = parseFloat(sliders[i].value);
  }
  sample = await midime.decode(tf.tensor(z, [1, 4]));
  currentSample = (await mvae.decode(sample))[0];

  z = sample.arraySync()[0];

  updateFullSliders(z);
  updateVisualizer();

}

function updateVisualizer() {
  vizSample = new music_vae.PianoRollSVGVisualizer(
    currentSample,
    document.getElementById("vizSample"),
    { noteRGB: "35,70,90", activeNoteRGB: "157, 229, 184", noteHeight: 5 }
  );
}

function plot(z, color = "white", el = "lines") {
  // We're actually displaying the most important N dimensions, not the first N dimensions,
  // so get those dimensions from the data.
  const data = [];
  for (let i = 0; i < N_DIMS; i++) {
    const dim = SORTED_DIMS[i];
    data.push(z[dim]);
  }

  const svgEl = document.getElementById(el);
  svgEl.innerHTML = "";

  const svg = d3.select("#" + el);

  const rekt = mvaeSliders.getBoundingClientRect();
  const width = rekt.width;
  const height = rekt.height;
  svg.attr("width", width + 10);
  svg.attr("height", width);

  const x = d3.scaleLinear().domain([0, N_DIMS]).range([0, width]);
  const y = d3.scaleLinear().domain([-2, 2]).range([height, 0]);

  function isEdge(i) {
    return i === 0 || i > N_DIMS;
  }

  const line = d3
    .line()
    .x((d, i) => (i == 0 ? -1 : x(i) - 2))
    .y((d, i) => (isEdge(i) ? height / 2 : y(d)))
    .curve(d3.curveStep);

  svg
    .append("g")
    .append("path")
    .datum([0, ...data, 0])
    .style("fill", color)
    .style("stroke", "#23465A")
    .style("stroke-opacity", 0.3)
    .style("fill-opacity", 1)
    .attr("d", line);
}

function plotLoss(data) {
  const svg = d3.select("#errorGraph");
  svg.selectAll("*").remove();

  const rekt = document
    .getElementById("duringTraining")
    .getBoundingClientRect();
  const width = rekt.width - 20;
  const height = 200;

  svg.attr("width", width);
  svg.attr("height", height);
  const margin = { left: 20, top: 20 };

  const dataset = d3.range(data.length).map((d, i) => data[i].toFixed(3));
  const x = d3
    .scaleLinear()
    .domain([0, data.length - 1])
    .range([0, width - 2 * margin.left]);
  const y = d3
    .scaleLinear()
    .domain([0, Math.max(...data)])
    .range([height - 2 * margin.top, 0]);

  const group = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  group
    .append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x));
  group.append("g").attr("class", "y axis").call(d3.axisLeft(y));

  const line = d3
    .line()
    .x((d, i) => x(i))
    .y((d) => y(d))
    .curve(d3.curveMonotoneX);
  group.append("path").datum(dataset).attr("class", "line").attr("d", line);
}

function updateUI(state) {
  function show(el) {
    document.getElementById(el).removeAttribute("hidden");
  }
  function hide(el) {
    document.getElementById(el).setAttribute("hidden", true);
  }
  function enable(el) {
    document.getElementById(el).removeAttribute("disabled");
  }
  function disable(el) {
    document.getElementById(el).setAttribute("disabled", true);
  }
  switch (state) {
    case "model-loading":
      hide("afterLoading");
      show("status");
      document.getElementById("status").textContent =
        "Loading model...one sec!";
      disable("btnSample");
      break;
    case "model-loaded":
      show("afterLoading");
      enable("btnSample");
      show("section_2");
      hide("status");
      hide("loadingStatus");
      break;
    case "file-loading":
      show("status");
      hide("input");
      hide("hasMelody");
      document.getElementById("status").textContent =
        "The robots are nomming on your file...";
      break;
    case "file-error":
      show("status");
      document.getElementById("status").textContent =
        "Oops, there was a problem reading your file. Make sure it's a valid MIDI and try again?";
      break;
    case "file-loaded":
      hide("status");
      show("section_3");
      show("input");
      enable("input");
      enable("section_3");
      hide("duringTraining");
      enable("btnTrain");
      hide("midimeSlidersContainer");
      btnTrain.focus();
      btnTrain.scrollIntoView();
      break;
    case "has-melody":
      show("hasMelody");
      break;
    case "training":
      disable("fileBtn");
      disable("section_2");
      disable("section_1");
      disable("sampleBtn");
      show("duringTraining");
      disable("btnTrain");
      hide("midimeSlidersContainer");
      errorGraph.scrollIntoView();
      break;
    case "training-done":
      enable("fileBtn");
      enable("sampleBtn");
      enable("section_2");
      show("afterTraining");
      enable("section_1");
      hide("beforeTraining");
      show("doneTraining");
      disable("btnTrain");
      show("midimeSlidersContainer");
      helpMsg.innerHTML =
        "Now that the model is trained, the random variations should sound much closer to your input!";
      btnSample.focus();
      btnSample.scrollIntoView();
  }
}

function updateCopy() {
  modeText.textContent = isMelodyMode ? "melody" : "trio";
  trainingSteps.value = 100; //(isMelodyMode ? 100 : 300);
}

// window.updateUI = updateUI;


  onMount(() => {

    init();

    d3.select(el)
      .selectAll("div")
      .data(data)
      .enter()
      .append("div")
      .style("width", function(d) {
        return d + "px";
      })
      .text(function(d) {
        return d;
      });
  });

</script>


<style>

  .container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;

    --slider-size: calc(90vw / 90);
    --thumb-size: calc(90vw / 80);
    /* --slider-size: 200px;
    --thumb-size: 100px; */
  }

  .scrollable {
    flex: 1 1 auto;
    /* border-top: 1px solid #eee; */
    margin: 0 0 0.5em 0;
    overflow-y: auto;
  }

  .chart :global(div) {
    font: 10px sans-serif;
    background-color: steelblue;
    text-align: right;
    padding: 3px;
    margin: 1px;
    color: white;
  }

  [hidden] {
    display: none !important;
  }

  [disabled] {
    opacity: 0.3;
    pointer-events: none;
  }

  /******************
  * Layout and colours
  ******************/
  p { line-height: 1.5; }

  /* #splashScreen p {
    margin-bottom: 32px;
  } */

  h1 {
    font-size: 60px;
    font-weight: normal;
    text-align: center;
    margin-top: 0;
  }

  #mainScreen h1 {
    font-size: 30px;
  }

  a {
    font-weight: bold;
    transition: color 0.2s linear;
  }

  a:link, a:visited {
    color: var(--blue);
    text-decoration: none;
    border-bottom: 2px solid var(--blue);
  }
  a:hover {
    background: var(--blue);
    color: var(--cream);
    text-decoration: none;
  }

  .full {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100vh;
    /* padding: 40px; */
    padding-top: 0;
  }

  .content {
    z-index: 1;
    position: relative;
    text-align: left;
    max-width: 900px;
    margin: 0 auto;
  }

  section {
    position: relative;
    margin: 40px 0;
  }

  #mainScreen section {
    /* padding: 40px; */
    /* background: white; */
    border-radius: 5px;
    text-align: left;
  }

  section .index {
    height: 60px;
    width: 60px;
    border-radius: 50%;
    background: var(--blue);
    color: white;
    font-weight: bold;
    font-size: 30px;
    line-height: 60px;
    text-align: center;
    position: absolute;
    left: -30px;
    top: 45px;
  }

  .with-padding {
    padding: 8px;
  }

  .horizontal {
    flex-direction: row;
    display: flex;
    justify-content: space-around;
    align-items: center;
  }

  .vertical {
    flex-direction: column;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .relative {
    position: relative;
  }

  .green {
    background: var(--green);
    border: none;
    color: var(--blue);
  }

  .blue {
    background: var(--blue);
    border: none;
    color: var(--cream);
  }

  .cream {
    background: var(--cream);
    border: 2px solid var(--blue);
    color: var(--blue);
  }

  /******************
  * Buttons
  ******************/
  .button {
    display: inline-block;
    font-family: inherit;
    font-weight: normal;
    transition: all 0.2s linear;
    text-align: center;
    padding: 8px;
    margin: 0;
    border: none;
    text-shadow: none;
    border-radius: 3px;
    cursor: pointer;

    font-size: 16px;
    vertical-align: middle;
    background: var(--blue);
    color: white;
  }

  .button:hover {
    background: var(--cream);
    color: var(--blue);
  }

  /* #splashScreen .button {
    padding: 14px 8px;
    min-width:300px;
  } */

  /* #splashScreen .button:hover {
    letter-spacing: 2px;
  } */

  .button-circle {
    display: inline-block;
    font-family: inherit;
    font-weight: bold;
    transition: all 0.2s linear;
    text-align: center;
    padding: 0;
    margin: 0 8px;
    border: none;
    border-radius: 50%;
    text-shadow: none;
    cursor: pointer;
    width: 30px;
    height: 30px;
    vertical-align: middle;
    background: var(--green);
    fill: var(--blue);
    position: absolute;
    top: 10px;
    right: 0;

  }
  .button-circle:hover {
    background: var(--blue);
    fill: var(--cream);
  }
  .button-circle > svg {
    pointer-events: none;
  }

  input[type="file"] {
    width: 0;
    height: 0;
    opacity: 0;
    cursor: pointer;
    display: none;
  }

  input[type="tel"], input[type="text"] {
    border: none;
    border-bottom: 4px solid var(--blue);
    box-shadow: none;
    font-size: inherit;
    width: 60px;
    background: transparent;
    color: inherit;
    font-weight: inherit;
    text-align: center;
  }

  input[type="text"] {
    width: 50%;
    font-family: inherit;
  }

  /******************
  * Sections
  ******************/
  .visualizer-container {
    overflow: auto;
    min-height: 100px;
  }

  /******************
  * Sliders
  ******************/
  .sliders-container {
    height: 200px;
    width: 100%;
    position: relative;
    margin: 8px 0;
    padding: 0 8px;
    overflow: hidden;
    text-align: center;
  }

  #midimeSlidersContainer {
    width: 300px;
    margin-right: 8px;
  }

  .rangeWrap {
    width: var(--slider-size);
    height: 100px;
    position: relative;
  }

  #lines {
    position: absolute;
    left: -1px;
  }

  /* input[type=range] { */
  input {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: 0;
    padding: 0;
    width: 100px;
    height: var(--thumb-size);
    transform: translate(-50%, -50%) rotate(-90deg);
  }

  input[type=range] {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background: transparent;
    border-bottom: none;
  }
  input[type=range]:hover {
    background: transparent;
  }

  /* Thumb */
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    border: none;
    height: var(--thumb-size);
    width: 4px;
    background: var(--blue);
    cursor: pointer;
    margin-top: -3px;
  }
  input[type=range]::-webkit-slider-thumb:hover {
    transform: scale(1.5);
  }
  input[type=range]::-moz-range-thumb {
    -webkit-appearance: none;
    border: none;
    height: var(--thumb-size);
    width: 4px;
    background: var(--blue);
    cursor: pointer;
    margin-top: -3px;
  }
  input[type=range]::-moz-range-thumb:hover {
    transform: scale(1.5);
  }
  input[type=range]::-ms-thumb {
    -webkit-appearance: none;
    border: none;
    height: var(--thumb-size);
    width: 4px;
    background: var(--blue);
    cursor: pointer;
    margin-top: -3px;
  }
  input[type=range]::-ms-thumb:hover {
    transform: scale(1.5);
  }

  input[type=range]::-webkit-slider-runnable-track {
    height: 2px;
    cursor: pointer;
    background: var(--blue);
  }
  input[type=range]::-moz-range-track {
    height: 2px;
    cursor: pointer;
    background: var(--blue);
  }
  input[type=range]::-ms-track {
    height: 2px;
    cursor: pointer;
    background: var(--blue);
  }


  #mvaeSliders input[type=range]::-webkit-slider-runnable-track {
    background: transparent;
  }

  #midimeSliders input[type=range]::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--green);
  }

  #mvaeSliders input[type=range]::-moz-range-track {
    background: transparent;
  }
  #midimeSliders input[type=range]::-moz-range-track {
    height: 4px;
    background: var(--green);
  }

  #mvaeSliders input[type=range]::-ms-track {
    background: transparent;
  }
  #midimeSliders input[type=range]::-ms-track {
    height: 4px;
    background: var(--green);
  }

  #midimeSliders input[type=range]::-webkit-slider-thumb {
    background: var(--green);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-top: -8px;
  }
  #midimeSliders input[type=range]::-moz-range-thumb {
    background: var(--green);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-top: -8px;
  }
  #midimeSliders input[type=range]::-ms-thumb {
    background: var(--green);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-top: -8px;
  }

  #errorGraph .line {
    fill: none;
    stroke: var(--blue);
    stroke-width: 4;
  }

  rect.active {
    outline: 1px solid black;
  }

  @media screen and (max-width: 800px) {
    .sliders {
      flex-direction:row !important;
    }
    #midimeSlidersContainer {
      width: 100%;
      margin-right: 0;
    }
  }

  @media screen and (max-width: 600px) {
    .full {
      padding: 0;
    }

    .horizontal {
      flex-direction: column;
    }


    .button {
      padding: 4px 8px;
      margin-bottom: 8px;
    }

    #mainScreen section {
      /* margin: 20px 10px;
      padding: 20px 10px; */
    }
    /* #splashScreen section {
      margin: 20px;
      padding: 0;
    } */
    .index {
      left: calc(50% - 40px) !important;
      top: -30px !important;
    }

    /* #splashScreen h1 {
      margin-bottom: 0;
      margin-top: 0;
    } */
    #mainScreen h1 {
      margin-bottom: 40px;
      /* --slider-size: 100px; */

    }
    input[type=range]::-webkit-slider-thumb {
      margin-top: -2px;
    }
  }

</style>

<div bind:this={ container } class='container scrollable'>

    <div class="full" id="mainScreen" hidden>
      <div class="content">
        <h1><span id="modeText">midi</span><b>me</b></h1>


        <section id="section_1">
          <div class="index" id="two">1</div>

          <b><p id="loadingStatus">Loading model...</p></b>

          <p>
            <button class="button" id="btnSample" bind:this={ btnSample} disabled>get sample</button>
          </p>

          <div id="afterLoading" hidden>
            <div class="horizontal">
              <div class="sliders-container blue" id="midimeSlidersContainer" hidden>
                <div class="sliders horizontal" id="midimeSliders" bind:this={ midimeSliders} >
                  <div class="range-wrap"><input type="range" data-index="0" min="-1" max="1" step="0.1" value="0" change="onSuperSliderChange()"></div>
                  <div class="range-wrap"><input type="range" data-index="1" min="-1" max="1" step="0.1" value="0" change="onSuperSliderChange()"></div>
                  <div class="range-wrap"><input type="range" data-index="2" min="-1" max="1" step="0.1" value="0" change="onSuperSliderChange()"></div>
                  <div class="range-wrap"><input type="range" data-index="3" min="-1" max="1" step="0.1" value="0" change="onSuperSliderChange()"></div>
                </div>
              </div>

              <div class="sliders-container green">
                <svg id="lines"></svg>
                <div class="sliders horizontal" id="mvaeSliders" bind:this={ mvaeSliders } ></div>
              </div>
            </div>

            <div class="relative">

              <div class="visualizer-container cream">

                <button id="btnPlaySample" bind:this={ btnPlaySample } class="button-circle" aria-label="play">
                  <svg class="iconPlay" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/><path d="M0 0h24v24H0z" fill="none"/></svg>
                  <svg class="iconStop" hidden xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 6h12v12H6z"/></svg>
                </button>

                <svg id="vizSample"></svg>

              </div>
            </div>
            <br>
            <button id="saveBtn" bind:this={ saveBtn } class="button">save this sample</button>

          </div>
        </section>

        <section id="section_2" hidden>
          <div class="index">2</div>

          <p>
            <label class="button" id="fileBtn" bind:this={ fileBtn }>
              load a midi file
              <input type="file" id="fileInput" multiple>
            </label>
            <!-- <b>or</b> -->
            <button id="sampleBtn" class="button" bind:this={ sampleBtn }>
              load our example
            </button>

            <div>
              <input id="urlInput" bind:this={ urlInput } type="text" value="https://bitmidi.com/uploads/15119.mid">
              <button id="urlBtn" bind:this={ urlBtn } class="button">
                load from url
              </button>.
            </div>
          <!-- </p> -->
          <b><p id="status" hidden></p></b>

          <div id="input" hidden>
            <div class="relative">
              <button id="btnPlayInput" bind:this={ btnPlayInput } class="button-circle" aria-label="play">
                <svg class="iconPlay" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                  <path d="M0 0h24v24H0z" fill="none"/>
                </svg>
                <svg class="iconStop" hidden xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M0 0h24v24H0z" fill="none"/>
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </button>
              <div class="visualizer-container cream">
                <svg id="vizInput"></svg>
              </div>
            </div>
          </div>
        </section>

        <section id="section_3" hidden>
          <div class="index">3</div>

          <div id="hasMelody" hidden>

            <div class="relative">
              <button id="btnPlayMelody" class="button-circle" aria-label="play" bind:this={ btnPlayMelody }>
                <svg class="iconPlay" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/><path d="M0 0h24v24H0z" fill="none"/></svg>
                <svg class="iconStop" hidden xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M0 0h24v24H0z" fill="none"/><path d="M6 6h12v12H6z"/>
                </svg>
              </button>
              <div class="visualizer-container cream">
                <svg id="vizMelody"></svg>
              </div>
            </div>
          </div>


          <p id="beforeTraining">
            <button class="button" bind:this={ btnTrain } id="btnTrain">start training!!</button> for
            <input id="trainingSteps" bind:this={ trainingSteps } value="100" type="tel"> steps.
          </p>

          <p id="doneTraining" hidden><b>Training complete!</b><br>
          </p>
          <div id="duringTraining" hidden>
            <p>Training step:
              <b id="trainingStep" bind:this={ trainingStep } >0</b> /
              <span id="totalSteps" bind:this={ totalSteps } >100</span>
            </p>
            <svg id="errorGraph" width="300"></svg>
          </div>
        </section>
      </div>
    </div>
</div>