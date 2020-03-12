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

function getHistoryItemsFromLocalStorage() {

  var items = {},
		keys = Object.keys(localStorage),
		i = keys.length;

	while (i--) {
		if (keys[i].startsWith("model-history-") || keys[i].startsWith("live-code-history") )
			items[keys[i]] = JSON.parse(window.localStorage.getItem(keys[i]));
	}

	return items;
}

function addToHistory(historyName, item) {
  let nowdate = Date.now();
  let nowstr = new Date(nowdate).toISOString();
  // e.g. Key: lchist_2020-03-02T15:48:31.080Z, 
  // Value: {"t":1583164111080,"code":":b:{{1,0.25}imp}\\909b; \n:s:{{1,0.25}imp}\\909; \n:c:{{{1,0.66}imp,{1,0.8}imp}add}\\909closed; \n:o:{{0.25,0.75}imp}\\909open; \n:tri:{40}tri; \n:sin:{45}sin; \n:saw:{4}saw; \n{:tri:, :saw:, {:sin:,0.4}mul, :b:, :o:, :c:, :s:}sum"}
  window.localStorage[historyName+nowstr] = JSON.stringify( { "t": nowdate, "code": item } );
}

function exportHistory() {

  console.log("DEBUG:History:ExportHistory: " );  
  console.log(getHistoryItemsFromLocalStorage());  
}

function clearHistory() {

  let items = Object.keys(getHistoryItemsFromLocalStorage());
  items.forEach(item => window.localStorage.removeItem(item));
}

module.exports = { addToHistory, clearHistory, exportHistory };
