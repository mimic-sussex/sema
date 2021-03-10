<script>
  export let checked = false;
  export let color = "#2196F3";
</script>

<style>
  .switch {
    position: relative;
    display: inline-block;
    /* width: 60px; */
    width: 40px;
    /* height: 34px; */
    height: 23px;
    margin-top: 5px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
    margin-top: 4px;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding-top: 4px;
    background-color: rgb(20, 20, 20);
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: .6em;
    border-color: aliceblue;
    border-width: 1px;
  }

  .slider:before {
    position: absolute;
    content: "";
    /* height: 26px; */
    height: 17px;
    /* width: 26px; */
    width: 17px;
    left: 4px;
    bottom: 3px;
    background-color: white;
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #2196f3;
  }

  input:checked + .slider {
    box-shadow: 0 0 1px #2196f3;
  }

  input:checked + .slider:before {
    -webkit-transform: translateX(16px);
    -ms-transform: translateX(16px);
    transform: translateX(16px);
  }
</style>

<label class="switch">
  <input type="checkbox" bind:checked />
  <span class="slider" />
</label>

