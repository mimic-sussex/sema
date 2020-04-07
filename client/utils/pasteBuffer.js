function copyToPasteBuffer(text) {
  let copyField=document.getElementById("hiddenCopyField");
  copyField.value = text;
  copyField.select();
  document.execCommand("Copy");
}

export {copyToPasteBuffer};
