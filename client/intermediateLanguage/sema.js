function num(val) {
	return { "@num": { value: val } };
}

function str(val) {
	return { "@string": val };
}

function synth(functionName, params) {
	let branch = {
		"@sigp": { "@params": params, "@func": { value: functionName } }
	};
	return branch;
}

function setvar(name, branch) {
	return { "@setvar": { "@varname": name, "@varvalue": branch } };
}

function getvar(name) {
	return { "@getvar": name };
}

module.exports = { num, str, synth, setvar, getvar };
