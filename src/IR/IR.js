var objectID = 0;

const oscMap = {
  '@sin': "sinewave",
  "@saw": "saw",
  "@square": "square",
  "@tri": "triangle",
  "@pha": "phasor"
};

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
      console.log("Creating code");
      code = IRToJavascript.emptyCode();
      console.log(code);
    }
    let attribMap = {
      '@lang': (ccode, el) => {
        console.log("lang")
        console.log(el);
        console.log(ccode)
        el.map((langEl) => {
          ccode = IRToJavascript.traverseTree(langEl, ccode);
        });
        return ccode;
      },
      '@spawn': (ccode, el) => {
        console.log(el);
        return IRToJavascript.traverseTree(el, ccode);
      },
      '@synth': (ccode, el) => {
        console.log(el);
        return IRToJavascript.traverseTree(el, ccode);
      },
      '@func': (ccode, el) => {
        console.log(el);
        let newCode = IRToJavascript.traverseTree(el, ccode);
        newCode.loop += ")";
        return newCode;
      },
      '@comp': (ccode, el) => {
        console.log("comp")
        console.log(el);
        el.map((compEl) => {
          console.log(compEl);
          ccode = IRToJavascript.traverseTree(compEl, ccode);
        });
        ccode.loop += ")";
        return ccode;
      },
      '@osc': (ccode, el) => {
        console.log("OSC");
        console.log(el);
        console.log(code);
        let objName = "osc" + IRToJavascript.getNextID();
        ccode.setup += `q.${objName} = new Module.maxiOsc();`;
        ccode.loop += `this._q.${objName}.${oscMap[el]}(`;
        return ccode;
      },
      '@add': (ccode, el) => {
        console.log(el);
        //expecting two arguments
        let code1 = IRToJavascript.traverseTree(el[0], IRToJavascript.emptyCode());
        let code2 = IRToJavascript.traverseTree(el[1], IRToJavascript.emptyCode());
        ccode.setup += code1.setup + code2.setup;
        ccode.loop += `(${code1.loop}) + ${code2.loop})`;
        return ccode;
      },
      'param': (ccode, p) => {
        ccode.loop += p;
        return ccode;
      }
    }
    console.log("Traverse")
    console.log(t)
    if (Array.isArray(t)) {
      t.map((el) => {
        Object.keys(el).map((k) => {
          console.log(el);
          console.log(k);
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
    let code = IRToJavascript.traverseTree(tree);
    code.setup = `() => {let q=[]; ${code.setup}; return q;}`;
    code.loop = `() => {return ${code.loop};}`
    return code;
  }

}

export default IRToJavascript;
