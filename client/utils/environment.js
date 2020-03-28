
var environment = {
  saveEnvironment: (name, data, storage) => {
    switch (storage) {
      "local":
        //save to local storage
      break;
      "pb":
        //store to the paste buffer
      break;
    }

  }
  loadEnvironment: (name, data, storage) => {
    switch (storage) {
      "local":
        //load from local storage
      break;
      "pb":
        //load from the paste buffer
      break;
      "gist":
        //load from a public gist
      break;
    }

  }
}


module.exports = {environment};
