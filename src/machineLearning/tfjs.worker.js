let freq=100.0;
onmessage = (m) => {
  postMessage({worker:'testmodel', val:freq});
  freq+=10;
};
