

var objectID = 0;

var vars = {};

var jsFuncMap = {
	saw: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.saw(${p[0].loop})`
	},
	sin: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.sinewave(${p[0].loop})`
	},
	tri: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.triangle(${p[0].loop})`
	},
	pha: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.phasor(${p[0].loop})`
	},
	ph2: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 3 ? p[3].loop : 0.0});`,
		loop:  (o, p) => `${o}.phasor(${p[0].loop},${p[1].loop},${p[2].loop})`
	},
	sqr: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.square(${p[0].loop})`
	},
	pul: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 2 ? p[2].loop : 0.0});`,
		loop:  (o, p) => `${o}.pulse(${p[0].loop},${p[1].loop})`
	},
	imp: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.impulse(${p[0].loop})`
	},
	sawn: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc();
                      ${o}.phaseReset(${p.length > 1 ? p[1].loop : 0.0});`,
		loop:  (o, p) => `${o}.sawn(${p[0].loop})`
	},
	noiz: {
		setup: (o, p) => `${o} = new Maximilian.maxiOsc()`,
		loop:  (o, p) => `${o}.noise()*${p[0].loop}`
	},
	gt: {
		setup: (o, p) => "",
		loop:  (o, p) => `((${p[0].loop} > ${p[1].loop}) ? 1 : 0)`
	},
	lt: {
		setup: (o, p) => "",
		loop:  (o, p) => `((${p[0].loop} < ${p[1].loop}) ? 1 : 0)`
	},
	mod: {
    setup: (o, p) => "",
    loop:  (o, p) => `(${p[0].loop} % ${p[1].loop})` },
	add: {
		setup: (o, p) => "",
		loop:  (o, p) => `(${p[0].loop}+${p[1].loop})`
	},
	mul: {
		setup: (o, p) => "",
		loop:  (o, p) => `(${p[0].loop}*${p[1].loop})`
	},
	sub: {
		setup: (o, p) => "",
		loop:  (o, p) => `(${p[0].loop}-${p[1].loop})`
	},
	div: {
		setup: (o, p) => "",
		loop:  (o, p) => `(${p[1].loop} != 0 ? ${p[0].loop}/${p[1].loop} : 0)`
	},
	pow: {
		setup: (o, p) => "",
		loop:  (o, p) => `Math.pow(${p[0].loop},${p[1].loop})`
	},
	abs: {
		setup: (o, p) => "",
		loop:  (o, p) => `Math.abs(${p[0].loop})`
	},
	env: {
		setup: (o, p) => `${o} = new Maximilian.maxiEnv();
                      ${o}.setAttack(${p[1].loop});
                      ${o}.setDecay(${p[2].loop});
                      ${o}.setSustain(${p[3].loop});
                      ${o}.setRelease(${p[4].loop})`,
		loop:  (o, p) => `${o}.adsr(1,${p[0].loop})`
	},
	sum: {
		setup: (o, p) => "",
		loop:  (o, p) => {
      let s = `(${p[0].loop}`;
			for (let i = 1; i < p.length; i++)
        s += `+${p[i].loop}`;
			return s + ")";	}
	},
	mix: {
		setup: (o, p) => "",
		loop:  (o, p) => {
			let s = `((${p[0].loop}`;
			for (let i = 1; i < p.length; i++)
        s += `+${p[i].loop}`;
			return s + `)/${p.length})`;
		}
	},
	prod: {
		setup: (o, p) => "",
		loop:  (o, p) => {
			let s = `(${p[0].loop}`;
			for (let i = 1; i < p.length; i++)
        s += `*${p[i].loop}`;
			return s + ")";
		}
	},
	blin: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiMap.linlin(${p[0].loop}, -1, 1, ${p[1].loop}, ${p[2].loop})`
	},
	ulin: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiMap.linlin(${p[0].loop}, 0, 1, ${p[1].loop}, ${p[2].loop})`
	},
	bexp: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiMap.linexp(${p[0].loop}, -1, 1, ${p[1].loop}, ${p[2].loop})`
	},
	uexp: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiMap.linexp(${p[0].loop}, 0.0000001, 1, ${p[1].loop}, ${p[2].loop})`
	},
	linlin: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiMap.linlin(${p[0].loop}, ${p[1].loop}, ${p[2].loop}),${p[3].loop}, ${p[4].loop})`
	},
	linexp: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiMap.linexp(${p[0].loop}, ${p[1].loop}, ${p[2].loop}), ${p[3].loop}, ${p[4].loop})`
	},
	dist: {
		setup: (o, p) => `${o} = new Maximilian.maxiDistortion()`,
		loop:  (o, p) => `${o}.atanDist(${p[0].loop},${p[1].loop})`
	},
	flange: {
		setup: (o, p) => `${o} = new Maximilian.maxiFlanger()`,
		loop:  (o, p) => `${o}.flange(${p[0].loop},${p[1].loop},${p[2].loop},${p[3].loop},${p[4].loop})`
	},
	chor: {
		setup: (o, p) => `${o} = new Maximilian.maxiChorus()`,
		loop:  (o, p) => `${o}.chorus(${p[0].loop},${p[1].loop},${p[2].loop},${p[3].loop},${p[4].loop})`
	},
	dl: {
		setup: (o, p) => `${o} = new Maximilian.maxiDelayline()`,
		loop:  (o, p) => `${o}.dl(${p[0].loop},${p[1].loop},${p[2].loop})`
	},
	lpf: {
		setup: (o, p) => `${o} = new Maximilian.maxiFilter()`,
		loop:  (o, p) => `${o}.lopass(${p[0].loop},${p[1].loop})`
	},
	hpf: {
		setup: (o, p) => `${o} = new Maximilian.maxiFilter()`,
		loop:  (o, p) => `${o}.hipass(${p[0].loop},${p[1].loop})`
	},
	lpz: {
		setup: (o, p) => `${o} = new Maximilian.maxiFilter()`,
		loop:  (o, p) => `${o}.lores(${p[0].loop},${p[1].loop},${p[2].loop})`
	},
	hpz: {
		setup: (o, p) => `${o} = new Maximilian.maxiFilter()`,
		loop:  (o, p) => `${o}.hires(${p[0].loop},${p[1].loop},${p[2].loop})`
	},

	toJS: { //freq, data, channel
		setup: (o, p) => `${o} = this.createMLOutputTransducer(${p[0].loop})`,
		loop:  (o, p) => `${o}.send(this.ifListThenToArray(${p[1].loop}), ${p[2].loop})`
	},

	fromJS: { //channel
		setup: (o, p) => `${o} = this.registerInputTransducer('ML', ${p[0].loop})`,
		loop:  (o, p) => `${o}.getValue()`
	},

	toPeer: { //value, dest, channel, frequency
    setup: (o, p) => `${o} = this.createNetOutputTransducer(${p[3].loop})`,
		loop:  (o, p) => `${o}.send(${p[0].loop},[${p[1].loop},${p[2].loop}])`
  },
	fromPeer: { //source, channel
		setup: (o, p) => `${o} = this.registerInputTransducer('NET', [${p[0].loop}, ${p[1].loop}])`,
		loop:  (o, p) => `${o}.getValue()`
  },

	oscin: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.OSCTransducer(${p[0].loop},${p[1].loop})`
	},
	oscout: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.OSCTransducer(${p[0].loop},${p[1].loop})`
	},
	sah: {
		setup: (o, p) => `${o} = new Maximilian.maxiSampleAndHold();`,
		loop:  (o, p) => `${o}.sah(${p[0].loop},${p[1].loop})`
	},
	stretch: {
		setup: (o, p) => `${o} = new Maximilian.maxiSample();
                      ${o}.setSample(this.getSampleBuffer(${p[4].loop}));
                      ${o}stretch = new Maximilian.maxiStretch();
                      ${o}stretch.setSample(${o});`,
		loop:  (o, p) => `(${o}.isReady() ? ${o}stretch.play(${p[0].loop},${p[1].loop},${p[2].loop},${p[3].loop},0.0) : 0.0)`
	},
	// 'adc': {"setup":(o,p)=>"", "loop":(o,p)=>`inputs[${p[0].loop}]`},
	adc: { setup: (o, p) => "", loop: (o, p) => `inputs` },
	sampler: {
		setup: (o, p) => `${o} = new Maximilian.maxiSample();
                      ${o}.setSample(this.getSampleBuffer(${p[1].loop}));`,
		loop:  (o, p) => `(${o}.isReady() ? ${o}.playOnZX(${p[0].loop}) : 0.0)`
	},
  loop: {
		setup: (o, p) => `${o} = new Maximilian.maxiSample();
                      ${o}.setSample(this.getSampleBuffer(${p[1].loop}));`,
		loop:  (o, p) => `(${o}.isReady() ? ${o}.play(${p[0].loop}) : 0.0)`
	},
  slice: {
		setup: (o, p) => `${o} = new Maximilian.maxiSample();
                      ${o}.setSample(this.getSampleBuffer(${p[2].loop}));`,
		loop:  (o, p) => `(${o}.isReady() ? ${o}.loopSetPosOnZX(${p[0].loop},${p[1].loop}) : 0.0)`
	},
	oscin: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.OSCTransducer(${p[0].loop},${p[1].loop})`
	},
	oscout: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.OSCTransducer(${p[0].loop},${p[1].loop})`
	},
	sah: {
		setup: (o, p) => `${o} = new Maximilian.maxiSampleAndHold();`,
		loop:  (o, p) => `${o}.sah(${p[0].loop},${p[1].loop})`
	},
	stretch: {
		setup: (o, p) => `${o} = new Maximilian.maxiSample();
                      ${o}.setSample(this.getSampleBuffer(${p[4].loop}));
                      ${o}stretch = new Maximilian.maxiStretch();
                      ${o}stretch.setSample(${o});`,
		loop:  (o, p) => `(${o}.isReady() ? ${o}stretch.play(${p[0].loop},${p[1].loop},${p[2].loop},${p[3].loop},0.0) : 0.0)`
	},
  bitToSig: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.toSignal(${p[0].loop})`
	},
  bitToTrigSig: {
  		setup: (o, p) => "",
  		loop:  (o, p) => `Maximilian.maxiBits.toTrigSignal(${p[0].loop})`
  	},
  bitNeg: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.neg(${p[0].loop})`
	},
  bitInc: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.inc(${p[0].loop})`
	},
  bitDec: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.dec(${p[0].loop})`
	},
  bitAnd: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.land(${p[0].loop},${p[1].loop})`
	},
  bitOr: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.lor(${p[0].loop},${p[1].loop})`
	},
  bitXor: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.lxor(${p[0].loop},${p[1].loop})`
	},
  bitShl: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.shl(${p[0].loop},${p[1].loop})`
	},
  bitShr: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.shr(${p[0].loop},${p[1].loop})`
	},
  bitAt: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.at(${p[0].loop},${p[1].loop})`
	},
  bitAdd: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.add(${p[0].loop},${p[1].loop})`
	},
  bitSub: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.sub(${p[0].loop},${p[1].loop})`
	},
  bitMul: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.mul(${p[0].loop},${p[1].loop})`
	},
  bitEq: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.eq(${p[0].loop},${p[1].loop})`
	},
  bitGt: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.gt(${p[0].loop},${p[1].loop})`
	},
  bitGte: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.gte(${p[0].loop},${p[1].loop})`
	},
  bitLte: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.lte(${p[0].loop},${p[1].loop})`
	},
  bitLt: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.lt(${p[0].loop},${p[1].loop})`
	},
  setup: (o, p) => "",
  bitDiv: {
		loop:  (o, p) => `Maximilian.maxiBits.div(${p[0].loop},${p[1].loop})`
	},
  bitr: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.at(${p[0].loop},${p[1].loop},${p[2].loop})`
	},
  bitnoise: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.noise()`
	},
  btime: {
		setup: (o, p) =>``,
		loop:  (o, p) => `this.bitTime`
	},
  bitFromSig: {
		setup: (o, p) => "",
		loop:  (o, p) => `Maximilian.maxiBits.fromSignal(${p[0].loop})`
	},
  clp: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.clockPhase(${p[0].loop},${p.length > 1 ? p[1].loop : 0})`
	},
  clt: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.clockTrig(${p[0].loop},${p.length > 1 ? p[1].loop : 0})`
	},
  clfreq: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.setClockFreq(${p[0].loop})`
	},
  clbpm: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.setClockFreq(60/${p[0].loop})`
	},
	barfreq: {
		setup: (o, p) => "",
		loop:  (o, p) => `this.setBarFrequency(${p[0].loop})`
	},
  onzx: {
		setup: (o, p) => `${o} = new Maximilian.maxiTrigger();`,
		loop:  (o, p) => `${o}.onZX(${p[0].loop})`
	},
  onchange: {
		setup: (o, p) => `${o} = new Maximilian.maxiTrigger();`,
		loop:  (o, p) => `${o}.onChanged(${p[0].loop},${p[1].loop})`
	},
  count: {
		setup: (o, p) => `${o} = new Maximilian.maxiCounter();`,
		loop:  (o, p) => `${o}.count(${p[0].loop},${p[1].loop})`
	},
  idx: {
		setup: (o, p) => `${o} = new Maximilian.maxiIndex();`,
		loop:  (o, p) => `${o}.pull(${p[0].loop},${p[1].loop},${p[2].loop})`
  },
  svf: {
    //set cutoff and resonance only when params change to save CPU
		setup: (o, p) => `${o} = new Maximilian.maxiSVF(); ${o}_p1 = new Maximilian.maxiTrigger(); ${o}_p2 = new Maximilian.maxiTrigger();`,
		loop:  (o, p) => `(()=>{${o}_cutoff = ${p[1].loop}; if (${o}_p1.onChanged(${o}_cutoff, 1e-5)) {${o}.setCutoff(${o}_cutoff)};
                            ${o}_res = ${p[2].loop}; if (${o}_p2.onChanged(${o}_res, 1e-5)) {${o}.setResonance(${o}_res)};
                        return ${o}.play(${p[0].loop},${p[3].loop},${p[4].loop},${p[5].loop},${p[6].loop})})()`
  },
  bitclock: {
    setup: (o, p) => "",
		loop:  (o, p) => `this.bitclock`
  },

	pvshift: {
		setup: (o, p) => `${o} = new pvshift();`,
		loop:  (o, p) => `${o}.play(${p[0].loop},${p[1].loop})`
	},

	rsq: {
		setup: (o, p) => `${o} = new Maximilian.maxiRatioSeq();`,
		loop:  (o, p) => {return p.length == 2 ? `${o}.playTrig(${p[0].loop},${p[1].loop})` : `${o}.playValues(${p[0].loop},${p[1].loop},${p[2].loop})`}
	}
};

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

  static traverseTree(t, code, level, vars, blockIdx) {
    // console.log(`DEBUG:IR:traverseTree:level: ${level}`);
    // console.log(`DEBUG:IR:traverseTree:vars:`);
    // console.log(vars);
    let attribMap = {
      '@lang': (ccode, el) => {
        let statements = [];
        el.map((langEl) => {
          let statementCode = IRToJavascript.traverseTree(langEl, IRToJavascript.emptyCode(), level, vars, blockIdx);
          // console.log("@lang: " + statementCode.loop);
          ccode.setup += statementCode.setup;
          ccode.loop += statementCode.loop;
          // ccode.paramMarkers
        });
        return ccode;
      },
      '@sigOut': (ccode, el) => {
        ccode = IRToJavascript.traverseTree(el, ccode, level, vars, blockIdx);
        ccode.loop = `q.sigOut = ${ccode.loop};`;
        return ccode;
      },
      '@spawn': (ccode, el) => {
        ccode = IRToJavascript.traverseTree(el, ccode, level, vars, blockIdx);
        ccode.loop += ";";
        return ccode;
      },
      '@sigp': (ccode, el) => {
        let paramMarkers = [{"s":el['paramBegin'], "e":el['paramEnd'], "l":level}]
        ccode.paramMarkers = ccode.paramMarkers.concat(paramMarkers);

        let functionName = el['@func'].value;
        let funcInfo = jsFuncMap[functionName];
        let objName = "q.b" + blockIdx + "u" + IRToJavascript.getNextID();

        let allParams=[];

        for (let p = 0; p < el['@params'].length; p++) {
          let params = IRToJavascript.emptyCode();
          params = IRToJavascript.traverseTree(el['@params'][p], params, level+1, vars, blockIdx);
          // console.log(params);
          allParams[p] = params;
        }
        // console.log(allParams);
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
        // console.log("DEBUG:traverseTree:@setvar");
        // console.log(vars);
        // console.log(el['@varname']);
        let variableName = el['@varname'].value;
        // console.log(variableName);
        let memIdx = vars[variableName];
        // console.log(memIdx);
        if (memIdx == undefined) {
          // console.log("var not found");
          memIdx = Object.keys(vars).length;
          vars[variableName] = memIdx;
          // console.log(memIdx);
        }
        let varValueCode = IRToJavascript.traverseTree(el['@varvalue'], IRToJavascript.emptyCode(), level+1, vars, blockIdx);
        ccode.setup += varValueCode.setup;
        // ccode.loop = `this.setvar(q, '${el['@varname']}', ${varValueCode.loop})`;
        ccode.loop = `(mem[${memIdx}] = ${varValueCode.loop})`;
        return ccode;
      },
      '@getvar': (ccode, el) => {
        let memIdx = vars[el.value];
        if (memIdx == undefined) {
					memIdx = Object.keys(vars).length;
          vars[el.value] = memIdx;
        }
        // ccode.loop += `this.getvar(q, '${el.value}')`;
        ccode.loop += `mem[${memIdx}]`;
        return ccode;
      },
      '@string': (ccode, el) => {
        // console.log(el.value);
        if (typeof el.value === 'string' || el.value instanceof String) {
          ccode.loop += `'${el.value}'`;
        }
        // else {
        //   ccode = IRToJavascript.traverseTree(el, ccode, level, vars, blockIdx);
        // }
        return ccode;
      },
      '@num': (ccode, el) => {
        if (el.value) {
          ccode.loop += `${el.value}`;
        }
        //  else {
        //   ccode = IRToJavascript.traverseTree(el, ccode, level);
        // }
        return ccode;
      },
      '@list': (ccode, el) => {
        //a list can be static and/or dynamic
        //create a vector for the list
        let objName = "q.b" + blockIdx + "l" + IRToJavascript.getNextID();
        ccode.setup += `${objName} = new Maximilian.VectorDouble();`;
        ccode.setup += `${objName}.resize(${el.length},0);`;

        //in the loop, we create a function that returns the list. It might also update dynamic elements of the list
        ccode.loop += `(()=>{`;
        let extraSetupCode = "";

        for(let i_list=0; i_list < el.length; i_list++) {
          //if the element is a static number, set this element once in the setup code
          let element =  IRToJavascript.traverseTree(el[i_list], IRToJavascript.emptyCode(), level, vars, blockIdx);
          if(Object.keys(el[i_list])[0] == '@num') {
              ccode.setup += `${objName}.set(${i_list}, ${element.loop});`;
          }else{
              //if the element not a number, set this element each update before returning the list
              extraSetupCode += element.setup;
              ccode.loop += `${objName}.set(${i_list}, ${element.loop});`;
          }
        }

        ccode.loop += `return ${objName}})()`;
        ccode.setup += extraSetupCode;
        // ccode.loop+=`${objName}`;
        // console.log(ccode);
        return ccode;
      }
    }

    if (Array.isArray(t)) {
      t.map((el) => {
        Object.keys(el).map((k) => {
          // console.log("DEBUG:traverseTree:@ARRAYAttribMap");
          // console.log(k);
          code = attribMap[k](code, el[k]);
        });
      })
    } else {
      Object.keys(t).map((k) => {
        // console.log("DEBUG:traverseTree:@OBJECTAttribMap");
        // console.log(k);
        code = attribMap[k](code, t[k]);
      });
    }
    return code;
  }

  static treeToCode(tree, blockIdx=0) {
    // console.log(tree);
    vars = {};
    let code = IRToJavascript.traverseTree(tree, IRToJavascript.emptyCode(), 0, vars, blockIdx);
    // console.log(vars);
    code.setup = `() => {let q=this.newq(); ${code.setup}; return q;}`;
    code.loop = `(q, inputs, mem) => {${code.loop} return q.sigOut;}`
    // console.log("DEBUG:treeToCode");
    // console.log(code.loop);
    // console.log(code.paramMarkers);
    return code;
  }
}

export default IRToJavascript;
