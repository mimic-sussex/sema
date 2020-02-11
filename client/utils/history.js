/*
notes:
localStorage doesn't allow objects so there's no way to add items to an array of history iitesm, unless you keep parsing it an unparsing it
which could bring in performance issues

instead: each history item is added as a separate localStorage entry, we'll need to add some utility functions to this class to organise
them an query them.

you can access all the keys in localStorage using Object.entries(localStoage) and then take things from there. Functions we need:

- clear history
- export history to document in date order (in a window) (supercollider style)


*/

function addToHistory(historyName, item) {
  let nowdate = Date.now();
  let nowstr = new Date(nowdate).toISOString();
  window.localStorage[historyName+nowstr] = JSON.stringify({"t":nowdate,"code":item});
}


module.exports = {addToHistory};
