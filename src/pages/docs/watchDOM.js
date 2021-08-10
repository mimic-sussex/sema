//class to watch node with targetID until a mutation with classname of targetName
//runMe should be a function to call when the targetName has been found
class DOMWatcher {
  constructor(watchID, targetName, runMe){
    
    this.watchNode = document.getElementById(watchID);
    this.targetName = targetName;
    this.runMe = runMe;
    this.config = { attributes: false, childList: true, subtree: true };
    this.observer = new MutationObserver( (mutationsList, observer) => {
      //console.log("callback being called");
      //console.log(this.watchNode, this.targetName);
      // Use traditional 'for loops' for IE 11
      for(const mutation of mutationsList) {
          if (mutation.type === 'childList') {
              //console.log(mutation.target.className, this.targetName);
              if (mutation.target.className == this.targetName){ // && $hashSection != ""){
                //console.log("found");
                this.runMe();
                this.stop();
              }
          }
      }
    });
    
  }

  start(){
    this.observer.observe(this.watchNode, this.config);
  }

  stop(){
    this.observer.disconnect();
  }
}


export {DOMWatcher};

/*
// monitors changes in markdown-container
//waits till markdown is rendered as html then jumps to hash location
function setupMutator() {
  // Select the node that will be observed for mutations
  const targetNode = document.getElementById('markdown-container');
  // Options for the observer (which mutations to observe)
  const config = { attributes: false, childList: true, subtree: true };

  // Callback function to execute when mutations are observed
  const callback = function(mutationsList, observer) {
      // Use traditional 'for loops' for IE 11
      for(const mutation of mutationsList) {
          if (mutation.type === 'childList') {
              if (mutation.target.className == "markdown-output" && $hashSection != ""){
                jumpToHash();
                endMutator(observer);
              }
          }
      }
  };

  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);
  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
}

function endMutator(observer){
  console.log("disconecting observer");
  observer.disconnect();
}

function jumpToHash(){
  document.getElementById($hashSection).scrollIntoView({behavior: 'smooth'});
}

function highlightCode(){
  // document.querySelectorAll('a').forEach((el) => {
    // console.log("elements in DOM", el);
    // hljs.highlightElement(el);
  // });
}
*/