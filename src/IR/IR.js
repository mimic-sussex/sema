var objectID = 0;

const oscMap = {
  '@sin': "sinewave",
  "@saw": "saw",
  "@square": "square",
  "@tri": "triangle",
  "@pha": "phasor"
};

const jsFuncMap = {
  // 'saw': ["new Module.maxiOsc()","saw"],
  'saw': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.saw(${p[0].loop})`},
  'sin': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.sinewave(${p[0].loop})`},
  'tri': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.triangle(${p[0].loop})`},
  'pha': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.phasor(${p[0].loop})`},
  'sqr': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.square(${p[0].loop})`},
  'sawn': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.sawn(${p[0].loop})`},
  'add': {"setup":(o,p)=>"", "loop":(o,p)=>`(${p[0].loop} + ${p[1].loop})`},
  'mul': {"setup":(o,p)=>"", "loop":(o,p)=>`(${p[0].loop} * ${p[1].loop})`},
  'mlmodel': {"setup":(o,p)=>`${o} = this.registerTransducer('testmodel', ${p[0].loop})`, "loop":(o,p)=>`${o}.io()`},
  // 'oscinput': ["","this.OSCTransducer"]
}

class IRToJavascript {

  static getNextID() {
    objectID = objectID > 9999 ? 0 : ++objectID;
    return objectID;
  }

  static emptyCode() {
    return {
      "setup": "",
      "loop": ""
    };
  }

  static traverseTree(t, code) {
    if (!code) {
      // console.log("Creating code");
      code = IRToJavascript.emptyCode();
      // console.log(code);
    }
    let attribMap = {
      '@lang': (ccode, el) => {
        // console.log("lang")
        // console.log(el);
        // console.log(ccode)
        el.map((langEl) => {
          ccode = IRToJavascript.traverseTree(langEl, ccode);
        });
        return ccode;
      },
      '@spawn': (ccode, el) => {
        // console.log(el);
        return IRToJavascript.traverseTree(el, ccode);
      },
      '@synth': (ccode, el) => {
        // console.log(el);
        // console.log(el['@jsfunc']);
        let functionName = el['@jsfunc'].value;
        let funcInfo = jsFuncMap[functionName];
        console.log(funcInfo);
        let objName = "q.u" + IRToJavascript.getNextID();

        console.log(el['@params']);
        console.log(el['@params'].length);
        let allParams=[];
        for (let p = 0; p < el['@params'].length; p++) {
          let params = IRToJavascript.emptyCode();
          console.log(el['@params'][p]);
          // if (p > 0) params.loop += ",";
          params = IRToJavascript.traverseTree(el['@params'][p], params);
          console.log(params);
          allParams[p] = params;
        }
        console.log(allParams);
        let setupCode="";
        for(let param in allParams) {
          setupCode += allParams[param].setup;
        }
        ccode.setup += `${setupCode} ${funcInfo.setup(objName, allParams)};`;
        ccode.loop += `${funcInfo.loop(objName, allParams)}`;

        // if (funccode[0] != "")
        // {
        //   ccode.setup += `${params.setup} ${objName} = ${funccode[0]};`;
        //   ccode.loop += `${objName}.${funccode[1]}(${params.loop})`;
        // }else{
        //   ccode.setup += `${params.setup}`;
        //   ccode.loop += `${funccode[1]}(${params.loop})`;
        // }
        // ccode.loop += `q.${objName}.${oscMap[el]}(`;
        // ccode.loop += `Math.random()`;
        console.log(ccode);
        return ccode;
        // return IRToJavascript.traverseTree(el, ccode);
      },
      '@num': (ccode, el) => {
        if (el.value) {
          console.log(el.value);
          ccode.loop += `${el.value}`;
        }else{
          ccode = IRToJavascript.traverseTree(el, ccode);
        }
        return ccode;
      }
      // '@func': (ccode, el) => {
      //   // console.log(el);
      //   let newCode = IRToJavascript.traverseTree(el, ccode);
      //   newCode.loop += ")";
      //   return newCode;
      // },
      // '@comp': (ccode, el) => {
      //   // console.log("comp")
      //   // console.log(el);
      //   el.map((compEl) => {
      //     // console.log(compEl);
      //     ccode = IRToJavascript.traverseTree(compEl, ccode);
      //   });
      //   ccode.loop += ")";
      //   return ccode;
      // },
      // '@osc': (ccode, el) => {
      //   // console.log("OSC");
      //   // console.log(el);
      //   // console.log(code);
      //   let objName = "osc" + IRToJavascript.getNextID();
      //   ccode.setup += `q.${objName} = new Module.maxiOsc();`;
      //   ccode.loop += `q.${objName}.${oscMap[el]}(`;
      //   return ccode;
      // },
      // '@io': (ccode, el) => {
      //   console.log('IO');
      //   console.log(el);
      //   return IRToJavascript.traverseTree(el, ccode);
      // },
      // '@OSCMsg': (ccode, el) => {
      //   console.log('OSCMsg');
      //   console.log(el);
      //   ccode.loop += `(this.OSCTransducer('${el.addr}', 0)`;
      //   return ccode;
      // },
      // '@MLModel': (ccode, el) => {
      //   let objName = "wkt" + IRToJavascript.getNextID();
      //   ccode.setup += `q.${objName} = this.registerTransducer('testmodel', ${el.input});`;
      //   ccode.loop += `(q.${objName}.io(${el.input})`;
      //   return ccode;
      // },
      // '@add': (ccode, el) => {
      //   // console.log(el);
      //   //expecting two arguments
      //   let code1 = IRToJavascript.traverseTree(el[0], IRToJavascript.emptyCode());
      //   let code2 = IRToJavascript.traverseTree(el[1], IRToJavascript.emptyCode());
      //   ccode.setup += code1.setup + code2.setup;
      //   ccode.loop += `(${code1.loop}) + ${code2.loop})`;
      //   return ccode;
      // },
      // 'param': (ccode, p) => {
      //   ccode.loop += p;
      //   return ccode;
      // }
    }
    console.log("Traverse")
    console.log(t)
    if (Array.isArray(t)) {
      t.map((el) => {
        Object.keys(el).map((k) => {
          // console.log(el);
          // console.log(k);
          code = attribMap[k](code, el[k]);
        });
      })
    } else {
      Object.keys(t).map((k) => {
        // console.log(k);
        code = attribMap[k](code, t[k]);
      });
    }
    return code;
  }

  static treeToCode(tree) {
    // console.log(tree);
    let code = IRToJavascript.traverseTree(tree);
    code.setup = `() => {let q=[]; ${code.setup}; return q;}`;
    code.loop = `(q) => {return ${code.loop};}`
    console.log(code.loop);
    return code;
  }

}

export default IRToJavascript;
