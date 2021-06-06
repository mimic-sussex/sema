<script>

  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  import { items } from '../../stores/playground.js'

  var data = [30, 86, 168, 281, 303, 365];
  let el;

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

  onMount(() => {
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

</style>

<div class='container scrollable'>
  <div class="define-input"
        >
    <button>Load midi file</button>
    <button>Load midi recording</button>

  </div>
  <div bind:this={ el }
        class="chart"
        >
  </div>


</div>