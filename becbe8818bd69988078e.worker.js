!function(o){var l={};function e(p){if(l[p])return l[p].exports;var t=l[p]={i:p,l:!1,exports:{}};return o[p].call(t.exports,t,t.exports,e),t.l=!0,t.exports}e.m=o,e.c=l,e.d=function(o,l,p){e.o(o,l)||Object.defineProperty(o,l,{enumerable:!0,get:p})},e.r=function(o){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(o,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(o,"__esModule",{value:!0})},e.t=function(o,l){if(1&l&&(o=e(o)),8&l)return o;if(4&l&&"object"==typeof o&&o&&o.__esModule)return o;var p=Object.create(null);if(e.r(p),Object.defineProperty(p,"default",{enumerable:!0,value:o}),2&l&&"string"!=typeof o)for(var t in o)e.d(p,t,function(l){return o[l]}.bind(null,t));return p},e.n=function(o){var l=o&&o.__esModule?function(){return o.default}:function(){return o};return e.d(l,"a",l),l},e.o=function(o,l){return Object.prototype.hasOwnProperty.call(o,l)},e.p="",e(e.s=0)}([function(o,l,e){"use strict";e.r(l);var p=0;const t={saw:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.saw(${l[0].loop})`},sin:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.sinewave(${l[0].loop})`},tri:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.triangle(${l[0].loop})`},pha:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.phasor(${l[0].loop})`},ph2:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>3?l[3].loop:0});`,loop:(o,l)=>`${o}.phasor(${l[0].loop},${l[1].loop},${l[2].loop})`},sqr:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.square(${l[0].loop})`},pul:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>2?l[2].loop:0});`,loop:(o,l)=>`${o}.pulse(${l[0].loop},${l[1].loop})`},imp:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.impulse(${l[0].loop})`},sawn:{setup:(o,l)=>`${o} = new Module.maxiOsc();\n                      ${o}.phaseReset(${l.length>1?l[1].loop:0});`,loop:(o,l)=>`${o}.sawn(${l[0].loop})`},noiz:{setup:(o,l)=>`${o} = new Module.maxiOsc()`,loop:(o,l)=>`${o}.noise()*${l[0].loop}`},gt:{setup:(o,l)=>"",loop:(o,l)=>`(${l[0].loop} > ${l[1].loop}) ? 1 : 0`},lt:{setup:(o,l)=>"",loop:(o,l)=>`(${l[0].loop} < ${l[1].loop}) ? 1 : 0`},mod:{setup:(o,l)=>"",loop:(o,l)=>`(${l[0].loop} % ${l[1].loop})`},add:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMath.add(${l[0].loop},${l[1].loop})`},mul:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMath.mul(${l[0].loop},${l[1].loop})`},sub:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMath.sub(${l[0].loop},${l[1].loop})`},div:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMath.div(${l[0].loop},${l[1].loop})`},pow:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMath.pow(${l[0].loop},${l[1].loop})`},abs:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMath.abs(${l[0].loop})`},env:{setup:(o,l)=>`${o} = new Module.maxiEnv();\n                      ${o}.setAttack(${l[1].loop});\n                      ${o}.setDecay(${l[2].loop});\n                      ${o}.setSustain(${l[3].loop});\n                      ${o}.setRelease(${l[4].loop})`,loop:(o,l)=>`${o}.adsr(1,${l[0].loop})`},sum:{setup:(o,l)=>"",loop:(o,l)=>{let e=`(${l[0].loop}`;for(let o=1;o<l.length;o++)e+=`+${l[o].loop}`;return e+")"}},mix:{setup:(o,l)=>"",loop:(o,l)=>{let e=`((${l[0].loop}`;for(let o=1;o<l.length;o++)e+=`+${l[o].loop}`;return e+`)/${l.length})`}},prod:{setup:(o,l)=>"",loop:(o,l)=>{let e=`(${l[0].loop}`;for(let o=1;o<l.length;o++)e+=`*${l[o].loop}`;return e+")"}},blin:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linlin(${l[0].loop}, -1, 1, ${l[1].loop}, ${l[2].loop})`},ulin:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linlin(${l[0].loop}, 0, 1, ${l[1].loop}, ${l[2].loop})`},bexp:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linexp(${l[0].loop}, -1, 1, ${l[1].loop}, ${l[2].loop})`},uexp:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linexp(${l[0].loop}, 0.0000001, 1, ${l[1].loop}, ${l[2].loop})`},linlin:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linlin(${l[0].loop}, ${l[1].loop}, ${l[2].loop}),${l[3].loop}, ${l[4].loop})`},linexp:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linexp(${l[0].loop}, ${l[1].loop}, ${l[2].loop}), ${l[3].loop}, ${l[4].loop})`},dist:{setup:(o,l)=>`${o} = new Module.maxiDistortion()`,loop:(o,l)=>`${o}.atanDist(${l[0].loop},${l[1].loop})`},flange:{setup:(o,l)=>`${o} = new Module.maxiFlanger()`,loop:(o,l)=>`${o}.flange(${l[0].loop},${l[1].loop},${l[2].loop},${l[3].loop},${l[4].loop})`},chor:{setup:(o,l)=>`${o} = new Module.maxiChorus()`,loop:(o,l)=>`${o}.chorus(${l[0].loop},${l[1].loop},${l[2].loop},${l[3].loop},${l[4].loop})`},dl:{setup:(o,l)=>`${o} = new Module.maxiDelayline()`,loop:(o,l)=>`${o}.dl(${l[0].loop},${l[1].loop},${l[2].loop})`},lpf:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.lopass(${l[0].loop},${l[1].loop})`},hpf:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.hipass(${l[0].loop},${l[1].loop})`},lpz:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.lores(${l[0].loop},${l[1].loop},${l[2].loop})`},hpz:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.hires(${l[0].loop},${l[1].loop},${l[2].loop})`},toJS:{setup:(o,l)=>`${o} = this.registerTransducer('${o}', ${l[0].loop})`,loop:(o,l)=>`${o}.send(${l[1].loop}, ${l[2].loop})`},fromJS:{setup:(o,l)=>`${o} = this.registerTransducer('${o}', ${l[0].loop})`,loop:(o,l)=>`${o}.receive(${l[1].loop})`},oscin:{setup:(o,l)=>"",loop:(o,l)=>`this.OSCTransducer(${l[0].loop},${l[1].loop})`},oscout:{setup:(o,l)=>"",loop:(o,l)=>`this.OSCTransducer(${l[0].loop},${l[1].loop})`},sah:{setup:(o,l)=>`${o} = new Module.maxiSampleAndHold();`,loop:(o,l)=>`${o}.sah(${l[0].loop},${l[1].loop})`},stretch:{setup:(o,l)=>`${o} = new Module.maxiSample();\n                      ${o}.setSample(this.getSampleBuffer(${l[4].loop}));\n                      ${o}stretch = new Module.maxiStretch();\n                      ${o}stretch.setSample(${o});`,loop:(o,l)=>`(${o}.isReady() ? ${o}stretch.play(${l[0].loop},${l[1].loop},${l[2].loop},${l[3].loop},0.0) : 0.0)`},blin:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linlin(${l[0].loop}, -1, 1, ${l[1].loop}, ${l[2].loop})`},ulin:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linlin(${l[0].loop}, 0, 1, ${l[1].loop}, ${l[2].loop})`},bexp:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linexp(${l[0].loop}, -1, 1, ${l[1].loop}, ${l[2].loop})`},uexp:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linexp(${l[0].loop}, 0.0000001, 1, ${l[1].loop}, ${l[2].loop})`},linlin:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linlin(${l[0].loop}, ${l[1].loop}, ${l[2].loop}),${l[3].loop}, ${l[4].loop})`},linexp:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiMap.linexp(${l[0].loop}, ${l[1].loop}, ${l[2].loop}), ${l[3].loop}, ${l[4].loop})`},dist:{setup:(o,l)=>`${o} = new Module.maxiDistortion()`,loop:(o,l)=>`${o}.atanDist(${l[0].loop},${l[1].loop})`},flange:{setup:(o,l)=>`${o} = new Module.maxiFlanger()`,loop:(o,l)=>`${o}.flange(${l[0].loop},${l[1].loop},${l[2].loop},${l[3].loop},${l[4].loop})`},chor:{setup:(o,l)=>`${o} = new Module.maxiChorus()`,loop:(o,l)=>`${o}.chorus(${l[0].loop},${l[1].loop},${l[2].loop},${l[3].loop},${l[4].loop})`},dl:{setup:(o,l)=>`${o} = new Module.maxiDelayline()`,loop:(o,l)=>`${o}.dl(${l[0].loop},${l[1].loop},${l[2].loop})`},lpf:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.lopass(${l[0].loop},${l[1].loop})`},hpf:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.hipass(${l[0].loop},${l[1].loop})`},lpz:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.lores(${l[0].loop},${l[1].loop},${l[2].loop})`},hpz:{setup:(o,l)=>`${o} = new Module.maxiFilter()`,loop:(o,l)=>`${o}.hires(${l[0].loop},${l[1].loop},${l[2].loop})`},toJS:{setup:(o,l)=>`${o} = this.registerTransducer('${o}', ${l[0].loop})`,loop:(o,l)=>`${o}.send(${l[1].loop}, ${l[2].loop})`},fromJS:{setup:(o,l)=>`${o} = this.registerTransducer('${o}', ${l[0].loop})`,loop:(o,l)=>`${o}.receive(${l[1].loop})`},adc:{setup:(o,l)=>"",loop:(o,l)=>"inputs"},sampler:{setup:(o,l)=>`${o} = new Module.maxiSample();\n                      ${o}.setSample(this.getSampleBuffer(${l[1].loop}));`,loop:(o,l)=>`(${o}.isReady() ? ${o}.playOnZX(${l[0].loop}) : 0.0)`},loop:{setup:(o,l)=>`${o} = new Module.maxiSample();\n                      ${o}.setSample(this.getSampleBuffer(${l[1].loop}));`,loop:(o,l)=>`(${o}.isReady() ? ${o}.play(${l[0].loop}) : 0.0)`},oscin:{setup:(o,l)=>"",loop:(o,l)=>`this.OSCTransducer(${l[0].loop},${l[1].loop})`},oscout:{setup:(o,l)=>"",loop:(o,l)=>`this.OSCTransducer(${l[0].loop},${l[1].loop})`},sah:{setup:(o,l)=>`${o} = new Module.maxiSampleAndHold();`,loop:(o,l)=>`${o}.sah(${l[0].loop},${l[1].loop})`},stretch:{setup:(o,l)=>`${o} = new Module.maxiSample();\n                      ${o}.setSample(this.getSampleBuffer(${l[4].loop}));\n                      ${o}stretch = new Module.maxiStretch();\n                      ${o}stretch.setSample(${o});`,loop:(o,l)=>`(${o}.isReady() ? ${o}stretch.play(${l[0].loop},${l[1].loop},${l[2].loop},${l[3].loop},0.0) : 0.0)`},bitToSig:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.toSignal(${l[0].loop})`},bitToTrigSig:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.toTrigSignal(${l[0].loop})`},bitNeg:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.neg(${l[0].loop})`},bitInc:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.inc(${l[0].loop})`},bitDec:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.dec(${l[0].loop})`},bitAnd:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.land(${l[0].loop},${l[1].loop})`},bitOr:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.lor(${l[0].loop},${l[1].loop})`},bitXor:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.lxor(${l[0].loop},${l[1].loop})`},bitShl:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.shl(${l[0].loop},${l[1].loop})`},bitShr:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.shr(${l[0].loop},${l[1].loop})`},bitAt:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.at(${l[0].loop},${l[1].loop})`},bitAdd:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.add(${l[0].loop},${l[1].loop})`},bitSub:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.sub(${l[0].loop},${l[1].loop})`},bitMul:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.mul(${l[0].loop},${l[1].loop})`},bitEq:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.eq(${l[0].loop},${l[1].loop})`},bitGt:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.gt(${l[0].loop},${l[1].loop})`},bitGte:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.gte(${l[0].loop},${l[1].loop})`},bitLte:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.lte(${l[0].loop},${l[1].loop})`},bitLt:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.lt(${l[0].loop},${l[1].loop})`},setup:(o,l)=>"",bitDiv:{loop:(o,l)=>`Module.maxiBits.div(${l[0].loop},${l[1].loop})`},bitr:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.at(${l[0].loop},${l[1].loop},${l[2].loop})`},bitnoise:{setup:(o,l)=>"",loop:(o,l)=>"Module.maxiBits.noise()"},btime:{setup:(o,l)=>"",loop:(o,l)=>"this.bitTime"},bitFromSig:{setup:(o,l)=>"",loop:(o,l)=>`Module.maxiBits.fromSignal(${l[0].loop})`},clp:{setup:(o,l)=>"",loop:(o,l)=>`this.clockPhase(${l[0].loop},${l.length>1?l[1].loop:0})`},clt:{setup:(o,l)=>"",loop:(o,l)=>`this.clockTrig(${l[0].loop},${l.length>1?l[1].loop:0})`},onzx:{setup:(o,l)=>`${o} = new Module.maxiTrigger();`,loop:(o,l)=>`${o}.onZX(${l[0].loop})`},onchange:{setup:(o,l)=>`${o} = new Module.maxiTrigger();`,loop:(o,l)=>`${o}.onChanged(${l[0].loop},${l[1].loop})`},count:{setup:(o,l)=>`${o} = new Module.maxiCounter();`,loop:(o,l)=>`${o}.count(${l[0].loop},${l[1].loop})`},index:{setup:(o,l)=>`${o} = new Module.maxiIndex();`,loop:(o,l)=>`${o}.pull(${l[0].loop},${l[1].loop},${l[2].loop})`},bitclock:{setup:(o,l)=>"",loop:(o,l)=>"this.bitclock"}};class ${static getNextID(){return p=p>9999?0:++p}static emptyCode(){return{setup:"",loop:"",paramMarkers:[]}}static traverseTree(o,l,e,p){let s={"@lang":(o,l)=>{return l.map(l=>{let t=$.traverseTree(l,$.emptyCode(),e,p);o.setup+=t.setup,o.loop+=t.loop}),o},"@sigOut":(o,l)=>((o=$.traverseTree(l,o,e,p)).loop=`q.sigOut = ${o.loop};`,o),"@spawn":(o,l)=>((o=$.traverseTree(l,o,e,p)).loop+=";",o),"@sigp":(o,l)=>{let s=[{s:l.paramBegin,e:l.paramEnd,l:e}];o.paramMarkers=o.paramMarkers.concat(s);let u=l["@func"].value,a=t[u],i="q.u"+$.getNextID(),n=[];for(let o=0;o<l["@params"].length;o++){let t=$.emptyCode();t=$.traverseTree(l["@params"][o],t,e+1,p),n[o]=t}let r="";for(let l in n)r+=n[l].setup,o.paramMarkers=o.paramMarkers.concat(n[l].paramMarkers);return o.setup+=`${r} ${a.setup(i,n)};`,o.loop+=`${a.loop(i,n)}`,o},"@setvar":(o,l)=>{let t=l["@varname"].value,s=p[t];null==s&&(s=Object.keys(p).length,p[t]=s);let u=$.traverseTree(l["@varvalue"],$.emptyCode(),e+1,p);return o.setup+=u.setup,o.loop=`(mem[${s}] = ${u.loop})`,o},"@getvar":(o,l)=>{let e=p[l.value];return null==e&&(e=Object.keys(p).length,p[l.value]=e),o.loop+=`mem[${e}]`,o},"@string":(o,l)=>("string"==typeof l||l instanceof String?o.loop+=`'${l}'`:o=$.traverseTree(l,o,e,p),o),"@num":(o,l)=>(l.value&&(o.loop+=`${l.value}`),o)};return Array.isArray(o)?o.map(o=>{Object.keys(o).map(e=>{l=s[e](l,o[e])})}):Object.keys(o).map(e=>{l=s[e](l,o[e])}),l}static treeToCode(o){let l=$.traverseTree(o,$.emptyCode(),0,{});return l.setup=`() => {let q=this.newq(); ${l.setup}; return q;}`,l.loop=`(q, inputs, mem) => {${l.loop} return q.sigOut;}`,l}}var s=$;onmessage=o=>{if(void 0!==o.data)try{let l=s.treeToCode(o.data.liveCodeAbstractSyntaxTree[0]);l.paramMarkers=JSON.stringify(l.paramMarkers),postMessage(l)}catch(o){console.log("DEBUG:il.worker:onmessage:catch"),console.log(o)}}}]);