/**
 * WorkletIndicator component
 */
const AudioWorkletIndicator = () => {
  const isAudioWorkletAvailable = _detectAudioWorklet();
  return isAudioWorkletAvailable
      ? html`<div class="was-indicator-found">AudioWorklet Ready</div>`
      : html`<div class="was-indicator-missing">No AudioWorklet</div>`;
};

// Check if AudioWorklet is available.
function _detectAudioWorklet() {
  let context = new OfflineAudioContext(1, 1, 44100);
  return Boolean(context.audioWorklet && typeof context.audioWorklet.addModule === 'function');
}

function html(s) {
  var temp = document.createElement('div');
  temp.innerHTML = s;
  return temp.innerHTML;
}


export default {
  AudioWorkletIndicator
};
