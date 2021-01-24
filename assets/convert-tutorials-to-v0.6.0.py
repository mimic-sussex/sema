import os
import json
import re
from shutil import copyfile

previous_format_directory = "./tutorial"

if not os.path.exists('tutorial-v0.6.0'):
  os.mkdir('tutorial-v0.6.0')




layouts = []

def newLayoutColumnObject(columnNr):
  return null

objectsToPack = ["resize", "drag", "responsive", "resizable", "draggable", "min", "max", "x", "y", "w", "h"]

def extractNewColumnElement(col_nr, elem, new_widget, widget):
  if col_nr in new_widget:
    new_widget[col_nr][elem] = widget[elem]
  else :
    new_widget[col_nr] = {}
    new_widget[col_nr][elem] = widget[elem]

# for each object
# keep "data" and "id" in the root
# and packup remaining props in an new sub object
# indexed by the NUMBER of layout COLUMNS (2, 3, 6, 8, 12)
def convertLayout(data):
  converted = []
  for widget in data:
    newWidget = {}
    for elem in widget:
      if elem == 'id':
        newWidget['id'] = widget[elem]
      elif elem in objectsToPack:
        # print(elem)
        extractNewColumnElement("2",  elem, newWidget, widget)
        extractNewColumnElement("3",  elem, newWidget, widget)
        extractNewColumnElement("6",  elem, newWidget, widget)
        extractNewColumnElement("8",  elem, newWidget, widget)
        extractNewColumnElement("12", elem, newWidget, widget)
      else :
        if 'data' not in newWidget:
          newWidget['data'] = {}
        if elem == 'data':
          newWidget['data']['content'] = widget[elem]
        else:
          newWidget['data'][elem] = widget[elem]
    # add new widget to new data
    converted.append(newWidget)
  return converted


def writeConvertedJSON(layout_path, converted_layout_path):
  with open(layout_path + '/layout.json', 'r') as layout:
    with open(converted_layout_path + '/layout.json', 'w') as converted_layout:
      json.dump(convertLayout(json.load(layout)), converted_layout)


# walk through the filesystem
# collect all the root paths from each tuple into list
# create directory on tempDir the way
for root, dirs, files in os.walk(previous_format_directory):
    for filename in files:
        if filename == 'tutorial.json':
          print ('tut: ' + filename)
        if filename == 'layout.json':
          # print ('root: ' + root)
          layouts.append(root)
          relative_path = root.split(previous_format_directory + '/')[1]
          print ('path: ' + relative_path)
          if not os.path.exists('./tutorial-v0.6.0/' + relative_path):
            os.makedirs('./tutorial-v0.6.0/' + relative_path)
            # copy markdown file to directory
          copyfile(root + '/index.md', './tutorial-v0.6.0/' + relative_path + '/index.md')
          writeConvertedJSON(root, './tutorial-v0.6.0/' + relative_path)
