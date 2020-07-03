// create the tree structure for a number
function num(val) {
	return { "@num": { value: val } };
}

// create the tree structure for a string - useful for naming samples
function str(val) {
	return { "@string": val };
}

// create the tree structure for a DSP function
function synth(functionName, params) {
	let branch = {
		"@sigp": { "@params": params, "@func": { value: functionName } }
	};
	return branch;
}

// create the tree structure for setting a variable
function setvar(name, value) {
	return { "@setvar": { "@varname": name, "@varvalue": value } };
}

// create the tree structure for reading a variable
function getvar(name) {
	return { "@getvar": name };
}

module.exports = { num, str, synth, setvar, getvar };
