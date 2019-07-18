var objectID = 0;




const oscMap = {
  '@sin': "sinewave",
  "@saw": "saw",
  "@square": "square",
  "@tri": "triangle",
  "@pha": "phasor"
};


const jsFuncMap = {
  'saw': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.saw(${p[0].loop})`},
  'sin': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.sinewave(${p[0].loop})`},
  'tri': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.triangle(${p[0].loop})`},
  'pha': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.phasor(${p[0].loop})`},
  'sqr': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.square(${p[0].loop})`},
  'sawn': {"setup":(o,p)=>`${o} = new Module.maxiOsc()`, "loop":(o,p)=>`${o}.sawn(${p[0].loop})`},
  'add': {"setup":(o,p)=>"", "loop":(o,p)=>`(${p[0].loop} + ${p[1].loop})`},
  'mul': {"setup":(o,p)=>"", "loop":(o,p)=>`(${p[0].loop} * ${p[1].loop})`},
  'sub': {"setup":(o,p)=>"", "loop":(o,p)=>`(${p[0].loop} - ${p[1].loop})`},
  'div': {"setup":(o,p)=>"", "loop":(o,p)=>`(${p[0].loop} / ${p[1].loop})`},
  'pow': {"setup":(o,p)=>"", "loop":(o,p)=>`Math.pow(${p[0].loop},${p[1].loop})`},
  'abs': {"setup":(o,p)=>"", "loop":(o,p)=>`Math.abs(${p[0].loop})`},
<<<<<<< HEAD
  'env': {"setup":(o,p)=>`${o} = new Module.maxiEnv();${o}.setAttack(${p[0].loop});${o}.setDecay(${p[0].loop});${o}.setSustain(${p[1].loop});${o}.setRelease(${p[2].loop});`, "loop":(o,p)=>`${o}.trigger = 1;`},
=======
  'blin': {"setup":(o,p)=>"", "loop":(o,p)=>`Module.maxiMap.linlin(${p[0].loop}, -1, 1, ${p[1].loop}, ${p[2].loop})`},
  'ulin': {"setup":(o,p)=>"", "loop":(o,p)=>`Module.maxiMap.linlin(${p[0].loop}, 0, 1, ${p[1].loop}, ${p[2].loop})`},
  'bexp': {"setup":(o,p)=>"", "loop":(o,p)=>`Module.maxiMap.linexp(${p[0].loop}, -1, 1, ${p[1].loop}, ${p[2].loop})`},
  'uexp': {"setup":(o,p)=>"", "loop":(o,p)=>`Module.maxiMap.linexp(${p[0].loop}, 0.0000001, 1, ${p[1].loop}, ${p[2].loop})`},
  'linlin': {"setup":(o,p)=>"", "loop":(o,p)=>`Module.maxiMap.linlin(${p[0].loop}, ${p[1].loop}, ${p[2].loop}),${p[3].loop}, ${p[4].loop})`},
  'linexp': {"setup":(o,p)=>"", "loop":(o,p)=>`Module.maxiMap.linexp(${p[0].loop}, ${p[1].loop}, ${p[2].loop}),${p[3].loop}, ${p[4].loop})`},
>>>>>>> ba95a6d27950f41e82545b369821a6966fd51351
  'lpf': {"setup":(o,p)=>`${o} = new Module.maxiFilter()`, "loop":(o,p)=>`${o}.lopass(${p[0].loop},${p[1].loop})`},
  'hpf': {"setup":(o,p)=>`${o} = new Module.maxiFilter()`, "loop":(o,p)=>`${o}.hipass(${p[0].loop},${p[1].loop})`},
  'lpz': {"setup":(o,p)=>`${o} = new Module.maxiFilter()`, "loop":(o,p)=>`${o}.lores(${p[0].loop},${p[1].loop},${p[2].loop})`},
  'hpz': {"setup":(o,p)=>`${o} = new Module.maxiFilter()`, "loop":(o,p)=>`${o}.hires(${p[0].loop},${p[1].loop},${p[2].loop})`},
  'toModel': {"setup":(o,p)=>`${o} = this.registerTransducer('testmodel', ${p[0].loop})`, "loop":(o,p)=>`${o}.send(${p[1].loop}, ${p[2].loop})`},
  'fromModel': {"setup":(o,p)=>`${o} = this.registerTransducer('testmodel', ${p[0].loop})`, "loop":(o,p)=>`${o}.receive(${p[1].loop})`},
  'adc': {"setup":(o,p)=>"", "loop":(o,p)=>`inputs[${p[0].loop}]`},
  'sample': {"setup":(o,p)=>`${o} = new Module.maxiSample();
                                    Module.setSample(${o}, this.translateFloat32ArrayToBuffer(event.data[${o}]));`,
            "loop":(o,p)=>`() => { if(${o}.zx([${p[0].loop}]) ${o}.trigger(); return ${o}.playOnce()}`},
}

class IRToJavascript {

  static getNextID() {
    objectID = objectID > 9999 ? 0 : ++objectID;
    return objectID;
  }

  static emptyCode() {
    return {
      "setup": "",
      "loop": "",
      "paramMarkers": []
    };
  }

  static traverseTree(t, code, level) {
    console.log(`Level: ${level}`);
    let attribMap = {
      '@lang': (ccode, el) => {
        // console.log("lang")
        // console.log(el);
        // console.log(ccode)
        el.map((langEl) => {
          ccode = IRToJavascript.traverseTree(langEl, ccode, level);
        });
        return ccode;
      },
      '@spawn': (ccode, el) => {
        return IRToJavascript.traverseTree(el, ccode, level);
      },
      '@synth': (ccode, el) => {
        console.log(el);
        // console.log(el['@jsfunc']);
        let paramMarkers = [{"s":el['paramBegin'], "e":el['paramEnd'], "l":level}]
        ccode.paramMarkers = ccode.paramMarkers.concat(paramMarkers);

        let functionName = el['@jsfunc'].value;
        let funcInfo = jsFuncMap[functionName];
        // console.log(funcInfo);
        let objName = "q.u" + IRToJavascript.getNextID();

        // console.log(el['@params']);
        // console.log(el['@params'].length);

        let allParams=[];

        for (let p = 0; p < el['@params'].length; p++) {
          let params = IRToJavascript.emptyCode();
          params = IRToJavascript.traverseTree(el['@params'][p], params, level+1);
          console.log(params);
          allParams[p] = params;
        }
        console.log(allParams);
        let setupCode = "";
        for (let param in allParams) {
          setupCode += allParams[param].setup;
          ccode.paramMarkers = ccode.paramMarkers.concat(allParams[param].paramMarkers);
        }
        ccode.setup += `${setupCode} ${funcInfo.setup(objName, allParams)};`;
        ccode.loop += `${funcInfo.loop(objName, allParams)}`;
        return ccode;
      },
      '@setvar': (ccode, el) => {
        let varValueCode = IRToJavascript.traverseTree(el['@varvalue'], IRToJavascript.emptyCode(), level+1);
        ccode.setup += varValueCode.setup;
        ccode.loop = `this.setvar(q, '${el['@varname']}', ${varValueCode.loop})`;
        return ccode;
      },
      '@oscreceiver': (ccode, el) => {
        console.log(el);
        // console.log(el['@jsfunc']);

        let setupCode="";
        let idxCode = "-1";
        if (el['@params'].length > 0) {
          let paramMarkers = [{"s":el['paramBegin'], "e":el['paramEnd'], "l":level}]
          ccode.paramMarkers = ccode.paramMarkers.concat(paramMarkers);
          let allParams=[];
          for (let p = 0; p < el['@params'].length; p++) {
            let params = IRToJavascript.emptyCode();
            params = IRToJavascript.traverseTree(el['@params'][p], params, level+1);
            console.log(params);
            allParams[p] = params;
          }
          console.log(allParams);
          for(let param in allParams) {
            setupCode += allParams[param].setup;
            ccode.paramMarkers = ccode.paramMarkers.concat(allParams[param].paramMarkers);
          }
          idxCode = allParams[0].loop;
        }
        let oscCode = `this.OSCTransducer('${el['@oscaddr'].value}',${idxCode})`;

        // IRToJavascript.traverseTree(el['@oscaddr'], IRToJavascript.emptyCode(), level+1);

        ccode.setup += `${setupCode}`;
        ccode.loop += `${oscCode}`;

        console.log(ccode.paramMarkers);

        return ccode;
      },
      '@num': (ccode, el) => {
        if (el.value) {
          console.log(el.value);
          ccode.loop += `${el.value}`;
        } else {
          ccode = IRToJavascript.traverseTree(el, ccode, level);
        }
        return ccode;
      },
      '@oscaddr': (ccode, el) => {
        console.log(el);
        // ccode.loop += `${el.value}`;
        ccode.loop += `this.OSCTransducer('${el.value}')`;
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
        console.log(k);
        code = attribMap[k](code, t[k]);
      });
    }
    return code;
  }

  static treeToCode(tree) {
    // console.log(tree);
    let code = IRToJavascript.traverseTree(tree, IRToJavascript.emptyCode(), 0);
    code.setup = `() => {let q=[]; ${code.setup}; return q;}`;
    code.loop = `(q, inputs) => {return ${code.loop};}`
    console.log(code.loop);
    console.log(code.paramMarkers);
    return code;
  }

}

export default IRToJavascript;
