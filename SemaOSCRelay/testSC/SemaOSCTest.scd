n = NetAddr.new("127.0.0.1", 7400);

w = Window.new("osc test");

f = w.addFlowLayout(5@5, 5@5);

[1,2,3,4].do({arg num;
	var oscpath = "/controls/fader%".format(num);
	EZSlider.new(
		w,
		30@200,
		label: "f%".format(num),
		action: {arg tez;
			(oscpath ++ ", " ++ tez.value).postln;
			n.sendMsg(oscpath, tez.value * 1000, 1tez.value * 2000);
		},
		layout:'vert'
	);
});

w.front;


