<script>

  import {
    items,
    focusedItemProperties,
    isUploadOverlayVisible,
    hydrateJSONcomponent
  } from  "../../stores/playground.js"


  function readJSONFileToItems(file){

  }

  function handleDragDrop(e) {
    try {
      e.preventDefault();
      let reader = new FileReader();
      reader.readAsText(e.dataTransfer.files[0]);
      reader.onload = e => $items = JSON.parse(e.target.result).map(item => hydrateJSONcomponent(item));
      $isUploadOverlayVisible = false;
    } catch (error) {

    }
  }

  function handleDragEnter(e){  }

  function handleSelectJSONFile(e){
    try{
      const input = document.querySelector("input[type=file]");
      let reader = new FileReader();
      reader.readAsText(input.files[0]);
      reader.onloadend = e => {
        $items = JSON.parse( reader.result ).map( item => hydrateJSONcomponent(item) );
        input.value = "";
        input.type = 'file';
        input.accept = '.json';
      }
      $isUploadOverlayVisible = false;

    }
    catch(err){

    }
  }

</script>

<div  class="upload-overlay-component"
      style='visibility:{ $isUploadOverlayVisible ? "visible": "hidden"}'
      on:drop={ handleDragDrop }
      on:dragenter={ handleDragEnter }
      ondragover="return false"
      >
  <svg version="1.1"
        id="Capa_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        class="light-mode"
        style="enable-background:new 0 0 512 512; width: 350px"
        xml:space="preserve"
        >
    <g>
      <path d="M50.283,44.999l-5.453-6.498c-0.016-0.019-0.038-0.032-0.055-0.051c-0.086-0.095-0.178-0.18-0.278-0.259
        c-0.012-0.01-0.022-0.021-0.036-0.029c-0.377-0.286-0.841-0.463-1.351-0.463c-0.511,0-0.974,0.177-1.351,0.463
        c-0.013,0.009-0.023,0.019-0.037,0.029c-0.099,0.079-0.192,0.164-0.276,0.259c-0.017,0.019-0.039,0.032-0.056,0.051l-5.453,6.498
        c-0.797,0.948-0.673,2.364,0.276,3.162c0.95,0.795,2.366,0.672,3.162-0.277l1.49-1.774v27.765c0,1.239,1.004,2.244,2.244,2.244
        c1.239,0,2.243-1.005,2.243-2.244V46.108l1.49,1.775c0.443,0.528,1.08,0.801,1.721,0.801c0.508,0,1.021-0.172,1.44-0.523
        C50.956,47.362,51.08,45.947,50.283,44.999z"/>
      <path d="M62.393,18.133c-0.832,0-1.664,0.062-2.489,0.181c-3.216-3.36-7.267-5.723-11.81-6.874
        c-0.059-0.016-0.119-0.029-0.18-0.04l-2.93-0.554c-3.584-4.482-9.01-7.117-14.803-7.117c-9.962,0-18.153,7.723-18.9,17.496
        C4.534,23.771,0,30.194,0,37.582c0,9.653,7.854,17.507,17.509,17.507c2.491,0,4.93-0.525,7.169-1.535
        c3.032,2.925,6.745,4.978,10.766,6.062v-6.255c-3.007-1.095-5.712-2.921-7.884-5.47c-0.587-0.69-1.427-1.053-2.279-1.053
        c-0.554,0-1.114,0.153-1.611,0.473c-1.834,1.173-3.964,1.792-6.161,1.792c-6.355,0-11.525-5.169-11.525-11.523
        c0-5.31,3.761-10.027,8.943-11.219c1.412-0.325,2.389-1.615,2.318-3.063l-0.02-0.32c-0.006-0.098-0.015-0.197-0.015-0.297
        c0-7.152,5.819-12.97,12.971-12.97c4.325,0,8.351,2.146,10.77,5.74c0.557,0.827,1.486,1.322,2.482,1.322c0.004,0,0.008,0,0.014,0
        l0.675-0.003l2.589,0.488c3.858,0.998,7.245,3.15,9.794,6.229c0.741,0.896,1.931,1.281,3.052,0.989
        c0.933-0.241,1.887-0.362,2.836-0.362c6.324,0,11.471,5.146,11.471,11.471c0,6.325-5.146,11.468-11.471,11.468
        c-0.949,0-1.903-0.121-2.834-0.361c-1.125-0.292-2.313,0.095-3.053,0.988c-1.605,1.938-3.564,3.474-5.726,4.613v6.59
        c3.419-1.297,6.542-3.332,9.123-6.025c0.825,0.12,1.657,0.182,2.489,0.182c9.625,0,17.455-7.83,17.455-17.455
        C79.848,25.963,72.016,18.133,62.393,18.133z"
        />
    </g>
  </svg>
  <p class="upload-overlay-text">
    <label  class="label-underline"
            for="file-input"
            >Choose your .json file
    </label>
    <input  type="file"
            id="file-input"
            accept=".json"
            on:change={ handleSelectJSONFile }
            > or drag'n'drop it here to upload a new environment!
  </p>
</div>

<style>

  .label-underline{
    text-decoration: underline;
  }

  #file-input {
    display: none;
  }

  .light-mode {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    padding-bottom:3px;
    width: 15px;
  }

  .upload-overlay-component {
    width: 100%;
    display:flex;
    justify-content:center;
    align-items:center;
    font-size:16px;

  }

  .upload-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    position: absolute;
    color: #FFF;
  }

</style>
