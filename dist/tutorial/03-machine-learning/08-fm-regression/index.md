# FM synthesis with neural network parameter mapping

## Introduction

This tutorial shows an example of how machine learning can be used interactively to explore large musical parameter spaces.  It also outlines the basic workflow of training and using machine learning models.

There may be some code in this tutorial that don't understand yet. If so, don't worry; it's more important here to understand the process of training the model.  You should be able to do this without understanding all the code in detail.

## The parameter mapping problem

In the livecoding window, there's code that creates sound using a technique called FM synthesis.  We're not concerned about the details of how this synth works in this tutorial, the important thing is that there are seven parameters that control the sound (each parameter is marked by a ```fromJS``` function).  FM synthesis is notorious for being unintuitive to edit - it's quite challenging to navigate through these parameters to find a sound that you want. The parameter space is huge, and the effects of changing the parameters can be unpredictable.  This is where machine learning can help. We're going to make a system that maps the mouse coordinates to the parameters of the synth, so you can explore it easily by moving the mouse around.  We'll train a machine learning model to do this mapping, from mouse to synthesis parameters.

## Creating a model

Run the code in the LC window, and then follow the steps in the JS window.  They will guide you through collecting data, training the model, and then using the model to explore sounds. During this process, you will create a dataset that associates areas of the screen with sounds from the synthesiser, and then create a neural network model that performs these mouse-to-sound mappings, and also estimates the mappings in-between.

## Further tasks

Once you have completed the initial task, here are some further things you can try:

1. Collect some new data for the model, and retrain it.  You can associate multiple screen areas with multiple sounds, and create mappings that are much more complex.
2. Clear the training data and start again (rerun the first block of code to reset everything)
3. See what happens with difficult training data - e.g. training two sounds for the same mouse positions
4. Change the frequency mappings in the LC window
5. When you have a trained model, try controlling it using oscillators instead of the mouse, for example using a low-frequency sine oscillator ```{{0.5}sin, 0, 1}blin```
6. Change the structure of the neural network - what happens if you expand or reduce the number of units in the hidden layer?  What if you add another layer?
7. What happens if you send the model unexpected input - numbers outside of the 0-1 range?  Does it sound interesting?
8. Add in more parameters to the system. For example you could add parameters to control the distortion in the ```asymclip``` function.
