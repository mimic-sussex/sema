//put all the awkward Web Audio API setup code here

function MMLLBasicGUISetup(callback, setup, audioblocksize = 256, microphone = true, audiofileload = true, parent) {

    var self = this;
    self.audionotrunning = true;
    self.webaudio;
    self.audioblocksize = audioblocksize;
    self.callback = callback;
    self.setup = setup;
    self.textnode;
    self.parent = parent;

    if (typeof self.parent === 'undefined') {
        self.parent = document.body; //default then is to append to end of current document
    }

    //    <button onclick="initMic()">Open Microphone</button><br>
    //    <button onclick="document.getElementById('file-input').click();">Open Audio File</button>
    //    <input id="file-input" type="file" name="name" style="display: none;" /><br><br>

    //    <canvas id="canvas" width="800" height="400">
    //    This text is displayed if your browser does not support HTML5 Canvas.
    //        </canvas>

    //    var canvas = document.getElementById('canvas');
    //    var context = canvas.getContext('2d');

    self.createStopButton = function () {

        self.stopbutton = document.createElement("BUTTON"); // Create a <button> element
        var t = document.createTextNode("Stop Audio"); // Create a text node
        self.stopbutton.appendChild(t); // Append the text to

        self.stopbutton.onclick = function () {

            if (self.audionotrunning == false) {

                //stop audio

                self.webaudio.audiocontext.close();

                self.audionotrunning = true;

                self.stopbutton.parentNode.removeChild(self.stopbutton);

                self.initGUI();

                //                self.webaudio.context.close().then(function() {
                //                            
                //                                                   //reset GUI for new audio
                //                                           self.stopbutton.parentNode.removeChild(self.stopbutton);
                //                                                   
                //                                            self.initGUI();
                //                                                   });
                //                await self.webaudio.context.close();
                //                
            }




        }

        self.parent.appendChild(self.stopbutton); // Append <button> to <body>


    };


    self.initGUI = function () {

        if (microphone) {

            self.openmicbutton = document.createElement("BUTTON"); // Create a <button> element
            var t = document.createTextNode("Open Microphone"); // Create a text node
            self.openmicbutton.appendChild(t); // Append the text to <button>

            self.openmicbutton.onclick = function () {

                if (self.audionotrunning) {

                    self.webaudio = new MMLLWebAudioSetup(self.audioblocksize, 1, self.callback, self.setup);

                    self.audionotrunning = false;
                }


                self.openmicbutton.parentNode.removeChild(self.openmicbutton);
                if (audiofileload)
                    self.openaudiofilebutton.parentNode.removeChild(self.openaudiofilebutton);
                self.parent.removeChild(self.textnode);

                self.createStopButton();


            }

            self.parent.appendChild(self.openmicbutton); // Append <button> to <body>

        }

        self.textnode = document.createTextNode(' --- ');
        self.parent.appendChild(self.textnode);

        if (audiofileload) {

            self.inputfile = document.createElement('input');
            self.inputfile.type = "file";
            self.inputfile.style = "display: none;";

            self.inputfile.addEventListener("change", function uploadFile() {
                console.log(self.inputfile.files[0], self.inputfile.files[0].name);


                if (self.audionotrunning) {

                    //pass in filename or 1 for audio input
                    self.webaudio = new MMLLWebAudioSetup(self.audioblocksize, self.inputfile.files[0], self.callback, self.setup);

                    //webaudio.initSoundFileRead(file_input.files[0]);

                    self.audionotrunning = false;
                }

            }, false);

            self.parent.appendChild(self.inputfile);

            self.openaudiofilebutton = document.createElement("BUTTON");
            var t = document.createTextNode("Open Audio File");
            self.openaudiofilebutton.appendChild(t);


            self.openaudiofilebutton.onclick = function () {
                self.inputfile.click();

                self.openaudiofilebutton.parentNode.removeChild(self.openaudiofilebutton);
                if (microphone)
                    self.openmicbutton.parentNode.removeChild(self.openmicbutton);
                self.parent.removeChild(self.textnode);

                self.createStopButton();


            };


            self.parent.appendChild(self.openaudiofilebutton);


        }

    };

    self.initGUI();

    //    self.whateverfunction = function(inputarg) {
    //        
    //        console.log('initialise GUI'); //debug console message
    //    
    //    };

}