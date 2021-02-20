
var environment = {
  saveEnvironment: (name, data, storage) => {
    switch (storage) {
      "local":
      console.log("load env");
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
      console.log("save env");
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
