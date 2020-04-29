var blockID = 0;
class blockData {
  constructor(startLine) {
    this.startLine = startLine;
    this.blockID = blockID++;
  }
}

class blockTracker {
  constructor(editorToTrack) {
    this.editor = editorToTrack;
    this.blocks = new Array();
    this.blocks.push(new blockData(-1));
  }

  onEditChange(change) {
    //recording where separators are
    let separatorExistsOnLine = (line) => {
      return this.blocks.filter(b => b.startLine == line).length == 1;
    }
    let insertSeparator = (line) => {
<<<<<<< HEAD:client/components/editors/liveCodeEditor.blockTracker.js
      let insertionIndex = this.blocks.findIndex(x=>x.startLine > line);
      // console.log("Inserting separator at " + line);
      const newBlock = new blockData(line, true);
=======
      let insertionIndex = this.blocks.findIndex(x => x.startLine > line);
      console.log("Inserting separator at " + line);
      const newBlock = new blockData(line);
>>>>>>> origin/multiblocks:client/UI/editors/liveCodeEditor.blockTracker.js
      if (insertionIndex == -1) {
        this.blocks.push(newBlock);
      } else {
        this.blocks.splice(insertionIndex, 0, newBlock);
      }
    }
<<<<<<< HEAD:client/components/editors/liveCodeEditor.blockTracker.js
    let testInsertLine = (lineIndex, lineText) => {
      if (/___+/.test(lineText)) {  // Test RegEx at least 3 underscores
          // console.log("Block separator found");
          if (separatorExistsOnLine(lineIndex)) {
              // console.log("separator already exists");
          }else{
              // console.log("adding new separator");
              insertSeparator(lineIndex);
              // console.table(this.blocks);
          }
=======
    let removeSeparator = (lineIndex) => {
      this.blocks = this.blocks.filter(b => b.startLine != lineIndex);
    }

    //testing text changes
    let testIsSeparator = (lineText) => {
      return /^___+$/.test(lineText);
    }
    let testLineChange = (lineIndex, lineText) => {
      let separatorAlreadyHere = separatorExistsOnLine(lineIndex);
      //is the line a separator?
      if (testIsSeparator(lineText)) { // Test RegEx at least 3 underscores and no other characters on the line
        console.log("Block separator found");
        if (separatorAlreadyHere) {
          console.log("separator already exists");
        } else {
          console.log("adding new separator");
          insertSeparator(lineIndex);
          console.table(this.blocks);
        }
      } else {
        if (separatorAlreadyHere) {
          //remove the separator as it's no longer valid
          removeSeparator(lineIndex);
        }
>>>>>>> origin/multiblocks:client/UI/editors/liveCodeEditor.blockTracker.js
      }
    }
    let testRemoveLine = (lineIndex, lineText, testTarget) => {
      //test for abscence or presence, depending on testTarget
<<<<<<< HEAD:client/components/editors/liveCodeEditor.blockTracker.js
      if (/___+/.test(lineText) == testTarget) {  // Test RegEx at least 3 underscores
        // console.log("testRemoveLine +ve at " + lineIndex);
        if (separatorExistsOnLine(lineIndex)) {
            // console.log("removing separator");
            this.blocks = this.blocks.filter(b=>b.startLine!=lineIndex);
=======
      if (testIsSeparator(lineText) == testTarget) { // Test RegEx at least 3 underscores
        console.log("testRemoveLine +ve at " + lineIndex);
        if (separatorExistsOnLine(lineIndex)) {
          console.log("removing separator");
          removeSeparator(lineIndex);
>>>>>>> origin/multiblocks:client/UI/editors/liveCodeEditor.blockTracker.js
        }
      }
    }
    let insertNewLines = (atLine, numberofLines) => {
      this.blocks = this.blocks.map(
        (b) => {
          if (b.startLine > atLine) {
            b.startLine += numberofLines;
          }
          return b;
        }
      );
    }
    let removeLines = (atLine, numberofLines) => {
      this.blocks = this.blocks.map(
        (b) => {
          if (b.startLine > atLine) {
            b.startLine -= numberofLines;
          }
          return b;
        }
      );
    }
<<<<<<< HEAD:client/components/editors/liveCodeEditor.blockTracker.js
    // console.log(change);
    switch(change.origin) {
        //same handler for deleting and cutting
        case "+delete":
        case "cut":
          //was a line single removed?
          if (change.removed.length==2 && change.removed[0] == "" && change.removed[1] == "") {
            // console.log("line removed");
            removeLines(change.from.line, 1);
            // console.table(this.blocks);
          }else{
            // console.log("Source line: " + this.editor.getLine(change.from.line));
            // console.log("Removed: " + change.removed);
            //check the first line (in case of partial removal)
            let startIdx = 0;
            let endIdx = change.removed.length;
            if (change.from.ch > 0) {
              // console.log("testing first line");
              testRemoveLine(change.from.line, this.editor.getLine(change.from.line), false);
              startIdx++;
            }
            if (change.to.ch > 0) {
              // console.log("testing last line");
              let lineToCheck = change.from.line + change.removed.length;
              testRemoveLine(lineToCheck, this.editor.getLine(change.from.line), false);
              endIdx--;
            }
            if (change.removed.length>1) {
              for(let i_line=startIdx; i_line < endIdx; i_line++) {
                // console.log("testing multi line " + i_line + ": " + change.removed[i_line]);
                testRemoveLine(change.from.line + i_line, change.removed[i_line], true);
                // console.table(this.blocks);
              }
              removeLines(change.from.line, change.removed.length-1);
            }
            // console.table(this.blocks);
          }
          break;
        case "+input":
          //was the input a new line?
          if (change.text.length==2 && change.text[0] == "" && change.text[1] == "") {
            // console.log("new line");
            insertNewLines(change.from.line, 1);
            // console.table(this.blocks);
=======
    console.log(change);
    switch (change.origin) {
      //same handler for deleting and cutting
      case "+delete":
      case "cut":
        if (change.from.line == change.to.line) {
          let lineToTest = this.editor.getLine(change.from.line);
          console.log(lineToTest);
          testLineChange(change.from.line, lineToTest);
        } else {
          //TODO this section needs more work to cases where change.from/to.ch>0 and for joining of separators
          console.log("Source line: " + this.editor.getLine(change.from.line));
          console.log("Removed: " + change.removed);
          let lastLineIndex = change.from.line + change.text.length - 1;
          let lastLine = this.editor.getLine(lastLineIndex);
          console.log("Lastline", lastLine);
          //test the first line
          let lineToTest = this.editor.getLine(change.from.line);
          for(let i_line=0; i_line < change.removed.length; i_line++) {
            console.log("testing multi line " + i_line + ": " + change.removed[i_line]);
            testRemoveLine(change.from.line + i_line, change.removed[i_line], true);
>>>>>>> origin/multiblocks:client/UI/editors/liveCodeEditor.blockTracker.js
          }
          removeLines(change.from.line, change.removed.length-1);


          // //check the first line (in case of partial removal)
          // let startIdx = 0;
          // let endIdx = change.removed.length;
          // if (change.from.ch > 0) {
          //   console.log("testing first line");
          //   testRemoveLine(change.from.line, this.editor.getLine(change.from.line), false);
          //   startIdx++;
          // }
          // if (change.to.ch > 0) {
          //   console.log("testing last line");
          //   let lineToCheck = change.from.line + change.removed.length;
          //   testRemoveLine(lineToCheck, this.editor.getLine(change.from.line), false);
          //   endIdx--;
          // }
          // if (change.removed.length>1) {
          //   for(let i_line=startIdx; i_line < endIdx; i_line++) {
          //     console.log("testing multi line " + i_line + ": " + change.removed[i_line]);
          //     testRemoveLine(change.from.line + i_line, change.removed[i_line], true);
          //     console.table(this.blocks);
          //   }
          //   removeLines(change.from.line, change.removed.length-1);
          // }
        }
        console.table(this.blocks);
        break;
<<<<<<< HEAD:client/components/editors/liveCodeEditor.blockTracker.js
        case "paste":
          let startLine = change.from.line;
          insertNewLines(change.from.line, change.text.length);
          for (let line in change.text) {
            // console.log(line);
            testInsertLine(startLine + parseInt(line), change.text[line]);
=======
      case "+input":
      case "paste":
        // console.log(change.)
        console.log("Source line: " + this.editor.getLine(change.from.line));
        console.log("Added: " + change.text);
        //no new lines?
        if (change.text.length == 1) {
          let lineToTest = this.editor.getLine(change.from.line);
          console.log(lineToTest);
          testLineChange(change.from.line, lineToTest);
        } else {
          //multiline insert
          //first deal with the possible broken separator
          let lastLineIndex = change.from.line + change.text.length - 1;
          let lastLine = this.editor.getLine(lastLineIndex);
          console.log("lastline", lastLine);
          //move any separators below
          insertNewLines(change.from.line, change.text.length - 1);

          //did a separator get broken or moved?
          if (separatorExistsOnLine(change.from.line)) {
            if (change.from.ch < 3) { // 3 character min for a separator
              console.log("ch < 3")
              //look at the last line
              if (testIsSeparator(lastLine)) {
                console.log("last line is separator")
                //move the separator
                this.blocks = this.blocks.map(b => {
                  console.log(b.startLine, lastLineIndex);
                  console.log(change.from);
                  if (b.startLine == change.from.line) {
                    b.startLine = lastLineIndex;
                    console.log("bs", b.startLine);
                  }
                  return b;
                });
              } else {
                removeSeparator(change.from.line);
              }
            } else {
              console.log('ch>3');
              //check if the paste has changed any separator on the first line
              testLineChange(change.from.line, this.editor.getLine(change.from.line));
              //possible new separator on the last line
              if (testIsSeparator(lastLine)) {
                console.log("last line is separator")
                insertSeparator(lastLineIndex);
              }
            }
          } else {
            //the block didn't start with a separator
            // let lineToTest = this.editor.getLine(change.from.line);
            // console.log('linetotest', lineToTest);
            // testLineChange(change.from.line, lineToTest);
            //look through the inserted text and test for new separators
            for (let line = 0; line < change.text.length; line++) {
              console.log(line);
              testLineChange(change.from.line + line, change.text[line]);
            }
            //TODO Monday: pasting in at the end of a separator
>>>>>>> origin/multiblocks:client/UI/editors/liveCodeEditor.blockTracker.js
          }

          // if (change.text.length > 2) {
          //   //move any separators pushed by this insert
          //   insertNewLines(change.from.line, change.text.length-1);
          //   //look through the inserted text and test for new separators
          //   for (let line=1; line < change.text.length-2; line++) {
          //     console.log(line);
          //     testInsertLine(change.from.line + line, change.text[line]);
          //   }
          // }
        }
        console.table(this.blocks);
        break;
      case "setValue":
        for (let line in change.text) {
          testLineChange(parseInt(line), change.text[line]);
        }
        console.table(this.blocks);
        break;
      case "undo":
        //TODO
        break;
      case "redo":
        //TODO
        break;
    };
  }

  getBlockFromLine(line) {
    let blockIndex=0;
    let nextBlockID=0
    for(let i=0; i < this.blocks.length-1; i++) {
      if (i==blocks.length-1) {
        blockIndex =i;
      }else{
        if (line > this.blocks[i].startLine && i < this.blocks[i+1].startLine) {
          blockIndex = i;
        }
      }
    }
    let blockID = this.blocks[blockIndex].blockID;
    return {id:blockID, idx:blockIndex};
  }

};

export {
  blockTracker,
  blockData
};
