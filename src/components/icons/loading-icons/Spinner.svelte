<script>
  export let size = 20
</script>

<style>
  @keyframes spinner {
    to {transform: rotate(360deg);}
  }

  .spinner:before {
    content: '';
    box-sizing: border-box;
    position: absolute;
    /* top: 50%; */
    /* left: 50%; */
    width: 20px;
    height: 20px;
    /* margin-top: -10px; */
    /* margin-left: -10px; */
    border-radius: 50%;
    border: 2px solid grey;
    border-top-color: #000;
    animation: spinner .3s linear infinite;
  }
</style>

<div id='spinnerid' class="spinner" style={`width:${size}; height:${size}`}></div>
