function num(val)  {
    return {"@num":{value:val}}
};

function str(val) {
    return {"@string":val}
};

function synth(functionName, params ) {
  let branch = {"@synth": {"@params":params, "@jsfunc":{value:functionName}}};
  return branch;
};

function setvar (name,branch) {
    return {"@setvar": {"@varname":name,"@varvalue":branch}};
};

module.exports = {num,str,synth,setvar};
