import IRToJavascript from "../client/intermediateLanguage/IR.js";


onmessage = m => {
	if (m.data !== undefined) {
		try {
			// postMessage({
			// 	treeTS: 1
			// });
      console.log("DEBUG:il.worker:onmessage:data");
			console.log(JSON.stringify(m.data.liveCodeAbstractSyntaxTree));

      console.log("DEBUG:il.worker:onmessage:treeToCode");
			let dspCode = IRToJavascript.treeToCode(
				m.data.liveCodeAbstractSyntaxTree
			);

      console.log("DEBUG:il.worker:onmessage:dspCode");
      console.log(dspCode);

			dspCode.paramMarkers = JSON.stringify(dspCode.paramMarkers);
			postMessage(dspCode);
		} catch (err) {
      console.log("DEBUG:il.worker:onmessage:catch");
			console.log(err);
		}
	}
};
