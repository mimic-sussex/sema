# GRAMMAR EDITOR

# Lexer [or tokenizer] definition with language lexemes [or tokens]

@{%

/*
Examples:

bpm 155;
kick*1 2,2,4,3,3,2 (dist:10);
snare*2+0.5 3,1 (dist:2);
closedhat*2 3,5,4,4 (dist:2);
openhat*1 1,3,4,4,4 (dist:3, hpf:2000);
lead*4 3,1,4,4,4 32,0,44 cut_mousey res99 env9 (hpf:1000, dist:100,amp:1);

*/

const lexer = moo.compile({
  separator:  /,/,
  semicolon:  /;/,
  colon:      /\:/,
  parenl:     /\(/,
  parenr:     /\)/,
	bpm:        /bpm/,
	effectDist: /dist/,
	effectHPF:  /hpf/,
	effectLPF:  /lpf/,
	effectAmp:  /amp/,
	mousex:     /mousex/,
	mousey:     /_mousey/,
	cut:        /cut/,
	res:        /res/,
	env:        /env/,
	kick:       /kick/,
	snare:      /snare/,
	hatopen:    /openhat/,
	hatclosed:  /closedhat/,
	bass:       /bass/,
	lead:       /lead/,
	speedop:    /\*/,
	offsetop:   /\+/,
	number:     /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?\b/,
  funcName:   /[a-zA-Z][a-zA-Z0-9]*/,
  comment:    /\/\/[^\n]*/,
  ws:         { match: /\s+/, lineBreaks: true},
});


function doEffects(effects, tree) {
	if (effects.length >0) {
		for(let e in effects) {
			switch(effects[e][0]) {
				case 'dist':
        	tree = sema.synth('hardclip', [sema.synth('mul', [tree,sema.num(effects[e][1])]) ]);
          break;
				case 'hpf':
					tree = sema.synth('hpz', [tree, sema.num(effects[e][1]), sema.num(0.5)]);
				  break;
				case 'lpf':
					tree = sema.synth('lpz', [tree, sema.num(effects[e][1]), sema.num(0.5)]);
				  break;
				case 'amp':
					tree = sema.synth('mul', [tree, sema.num(effects[e][1])]);
				  break;
			}
		}
	}
	return tree;
}

function sequencer(speed, sample, ratios, offset, effects) {
	let tree=0;
	let clk = sema.synth('clp', [sema.num(speed), sema.num(offset)]);
	let seq = sema.synth('rsq', [clk, { '@list': ratios } ])
//	let triggers = sema.synth('imp', [sema.num(speed)]);
	tree = sema.synth( 'sampler', [seq, { "@string": sample }] )
	tree = doEffects(effects, tree);
	return tree;
}

function synth(speed, ratios, freqs, cutoff, resonance, envd, effects) {
	let clk = sema.synth('clp', [sema.num(speed), sema.num(0)]);
	let seq = sema.synth('rsq', [clk, { '@list': ratios } ]);
	let pitch = sema.synth('rsq', [clk, { '@list': ratios }, { '@list': freqs }  ]);
	let slide = sema.num(0);
	let accent = sema.num(0);
	let kill = sema.num(0);
	let wave = sema.num(0);
	let cut = cutoff;
	let res = sema.num(resonance);
	let envdepth = sema.num(envd);
	let att = sema.num(10);
	let dec = sema.num(90);
	let accLevel = sema.num(1);
	let o303 = sema.synth('o303', [seq, pitch, slide, accent, kill, wave, cut, res, envdepth, att, dec, accLevel]);
	o303 = doEffects(effects, o303);
	return sema.synth('mul', [o303,sema.num(0.5)]);
}

function mix() {
 	return sema.synth('mix', [
    sema.getvar( 'kick'),
	  sema.getvar( 'snare') ,
	  sema.getvar( 'hato' ),
	  sema.getvar( 'hatc' ),
	  sema.getvar( 'bass' ),
	  sema.getvar( 'lead' )
	]);
}

%}

# Pass your lexer object using the @lexer option
@lexer lexer

# Grammar definition in the Extended Backus Naur Form (EBNF)
main ->
  _ Statement _
  {% d => ( { '@lang' : d[1].concat([sema.synth( 'dac', [mix()] )]) } )  %}

Statement ->
  Expression _ %semicolon _ Statement
  {% d => [ { '@spawn': d[0] } ].concat(d[4]) %}
  |
  Expression _ %semicolon
  {% d => [ { '@spawn': d[0] } ] %}
	|
	%comment _ Statement
	{% d => d[2] %}


Expression ->
  Instrument Speed:? Offset:? _ Numberlist:? _ Effects:?
  {% d => {
      let channelName = d[0][0];
      let sampleName = d[0][1];
      let speed = d[1] ? d[1] : 1;
      let ratios = d[4] ? d[4] : [sema.num(1)];
      let offset = d[2] ? d[2] : 0;
      let effects = d[6] ? d[6] : [];
      return sema.setvar(channelName, sequencer(speed, sampleName, ratios, offset, effects ))
    }
  %}
  | Synth Speed:? _ Numberlist _ Numberlist (_ Cutoff):? (_ Resonance):? (_ EnvDepth):? _ Effects:?
  {% d => {
      let speed = d[1] ? d[1] : 1;
      let ratios = d[3] ? d[3] : [sema.num(1)];
      let freqs = d[5] ? d[5] : [sema.num(40)];
      let cutoff = d[6] ? d[6][1] : sema.num(1000);
      let res = d[7] ? d[7][1].value : 50;
      let envd = d[8] ? d[8][1].value : 50;
      let effects = d[10] ? d[10] : [];
      return sema.setvar(d[0], synth(speed, ratios, freqs, cutoff, res, envd,effects))
    }
  %}
  | %bpm _ %number
  {% d => sema.synth('clk', [sema.num(d[2].value), sema.num(4)]) %}

Cutoff -> %cut MouseCtl {% d=>d[1]%}

Resonance -> %res %number {%d => d[1]%}

EnvDepth -> %env %number {%d => d[1]%}

MouseCtl ->
  %number  {% d => sema.num(d[0].value) %}
  | %mousey {% d => sema.synth('uexp', [sema.synth('mouseY', []), sema.num(20), sema.num(5000)]) %}

SynthParam => %number

Synth ->
  %bass
  {% d =>'bass' %}
  | %lead
  {% d => 'lead' %}


Instrument ->
  %kick {% d => ['kick', '909b'] %}
  |
  %snare {% d => ['snare', '909'] %}
  |
  %hatopen {% d => ['hato', '909open'] %}
  |
  %hatclosed {% d => ['hatc', '909closed'] %}

Effects ->
  %parenl _ EffectList _ %parenr
  {% d => d[2] %}

EffectList ->
  Effect
  {% d => [d[0]] %}
  |
  Effect _ %separator _ EffectList
  {% d => [d[0]].concat(d[4]) %}


Effect ->
  EffectName %colon %number
  {% d => [d[0],d[2].value] %}

EffectName ->
  %effectDist {% d => 'dist' %}
  |
  %effectHPF {% d=>'hpf' %}
  |
  %effectLPF {% d=>'lpf' %}
  |
  %effectAmp {% d=>'amp' %}

Numberlist ->
  %number
  {% d => ( [ sema.num(d[0].value) ] ) %}
  |
  %number _ %separator _ Numberlist
  {% d => [ sema.num(d[0].value) ].concat(d[4]) %}


Speed ->
  %speedop _ %number
  {% d => d[2].value %}

Offset ->
  %offsetop _ %number
  {% d => d[2].value %}

# Whitespace

_  -> wschar:*
{% function(d) {return null;} %}

__ -> wschar:+
{% function(d) {return null;} %}

wschar -> %ws
{% id %}
