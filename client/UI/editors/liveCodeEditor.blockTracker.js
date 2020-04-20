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
      let insertionIndex = this.blocks.findIndex(x => x.startLine > line);
      console.log("Inserting separator at " + line);
      const newBlock = new blockData(line);
      if (insertionIndex == -1) {
        this.blocks.push(newBlock);
      } else {
        this.blocks.splice(insertionIndex, 0, newBlock);
      }
    }
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
      }
    }
    let testRemoveLine = (lineIndex, lineText, testTarget) => {
      //test for abscence or presence, depending on testTarget
      if (testIsSeparator(lineText) == testTarget) { // Test RegEx at least 3 underscores
        console.log("testRemoveLine +ve at " + lineIndex);
        if (separatorExistsOnLine(lineIndex)) {
          console.log("removing separator");
          removeSeparator(lineIndex);
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
    console.log(change);
    switch (change.origin) {
      //same handler for deleting and cutting
      case "+delete":
      case "cut":
        if (change.from.line = change.to.line) {
          let lineToTest = this.editor.getLine(change.from.line);
          console.log(lineToTest);
          testLineChange(change.from.line, lineToTest);
        } else {
          console.log("Source line: " + this.editor.getLine(change.from.line));
          console.log("Removed: " + change.removed);
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

};

export {
  blockTracker,
  blockData
};
