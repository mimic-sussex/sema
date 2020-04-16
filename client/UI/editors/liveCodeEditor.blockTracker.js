var blockID=0;
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
    this.blocks.push(new blockData(0));
  }

  onEditChange(change) {
    let separatorExistsOnLine = (line) =>  {
      return this.blocks.filter(b=>b.startLine==line).length == 1;
    }
    let insertSeparator = (line) => {
      let insertionIndex = this.blocks.findIndex(x=>x.startLine > line);
      console.log("Inserting separator at " + line);
      const newBlock = new blockData(line);
      if (insertionIndex == -1) {
        this.blocks.push(newBlock);
      }else{
        this.blocks.splice(insertionIndex, 0, newBlock);
      }
    }
    let testInsertLine = (lineIndex, lineText) => {
      if (/___+/.test(lineText)) {  // Test RegEx at least 3 underscores
          console.log("Block separator found");
          if (separatorExistsOnLine(lineIndex)) {
              console.log("separator already exists");
          }else{
              console.log("adding new separator");
              insertSeparator(lineIndex);
              console.table(this.blocks);
          }
      }
    }
    let testRemoveLine = (lineIndex, lineText, testTarget) => {
      //test for abscence or presence, depending on testTarget
      if (/___+/.test(lineText) == testTarget) {  // Test RegEx at least 3 underscores
        console.log("testRemoveLine +ve at " + lineIndex);
        if (separatorExistsOnLine(lineIndex)) {
            console.log("removing separator");
            this.blocks = this.blocks.filter(b=>b.startLine!=lineIndex);
        }
      }
    }
    let insertNewLines = (atLine, numberofLines) => {
      this.blocks = this.blocks.map(
        (b)=>{
          if (b.startLine > atLine) {
            b.startLine+=numberofLines;
          }
          return b;
        }
      );
    }
    let removeLines = (atLine, numberofLines) => {
      this.blocks = this.blocks.map(
        (b)=>{
          if (b.startLine > atLine) {
            b.startLine-=numberofLines;
          }
          return b;
        }
      );
    }
    console.log(change);
    switch(change.origin) {
        //same handler for deleting and cutting
        case "+delete":
        case "cut":
          //was a line single removed?
          if (change.removed.length==2 && change.removed[0] == "" && change.removed[1] == "") {
            console.log("line removed");
            removeLines(change.from.line, 1);
            console.table(this.blocks);
          }else{
            console.log("Source line: " + this.editor.getLine(change.from.line));
            console.log("Removed: " + change.removed);
            //check the first line (in case of partial removal)
            let startIdx = 0;
            let endIdx = change.removed.length;
            if (change.from.ch > 0) {
              console.log("testing first line");
              testRemoveLine(change.from.line, this.editor.getLine(change.from.line), false);
              startIdx++;
            }
            if (change.to.ch > 0) {
              console.log("testing last line");
              let lineToCheck = change.from.line + change.removed.length;
              testRemoveLine(lineToCheck, this.editor.getLine(change.from.line), false);
              endIdx--;
            }
            if (change.removed.length>1) {
              for(let i_line=startIdx; i_line < endIdx; i_line++) {
                console.log("testing multi line " + i_line + ": " + change.removed[i_line]);
                testRemoveLine(change.from.line + i_line, change.removed[i_line], true);
                console.table(this.blocks);
              }
              removeLines(change.from.line, change.removed.length-1);
            }
            console.table(this.blocks);
          }
          break;
        case "+input":
          //was the input a new line?
          if (change.text.length==2 && change.text[0] == "" && change.text[1] == "") {
            console.log("new line");
            insertNewLines(change.from.line, 1);
            console.table(this.blocks);
          }
          testInsertLine(change.from.line, this.editor.getLine(change.from.line));
        break;
        case "paste":
          let startLine = change.from.line;
          insertNewLines(change.from.line, change.text.length);
          for (let line in change.text) {
            console.log(line);
            testInsertLine(startLine + parseInt(line), change.text[line]);
          }

        break;
        case "setValue":
          for (let line in change.text) {
            testInsertLine(parseInt(line), change.text[line]);
          }
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

export {blockTracker, blockData};
