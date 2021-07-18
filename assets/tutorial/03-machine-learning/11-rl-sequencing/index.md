# Sequencing with Interactive Reinforement Learning

In the previous tutorial *'a machine learning powered sequencer'*, you can learn about reinforcement learning (RL) through a simple ML-powered language, *Rubber Gosling*.  This gives an easy entry point to RL, but also limits its application to the sounds and sequencing methods available in that language.  Here, the same reinforcement script is linked into to the default language, so you can have fuller control over the sounds and sequences that the RL model is learning from and controlling.  You can also change some meta-parameters in the JS script that shape the behaviour of the agent.

## Beat prediction, and a rough guide to interactive reinforcement learning

Reinforcement learning is a branch of machine learning that has had some huge successes (e.g. Deepmind's AlphaGo). In RL, an *agent* explores an *environment* by choosing *actions* to take based on input from the environment. When an action is successful, it receives a *reward*.  If an action is not successful, it receives a *penalty*.   The rewards and penalties refine the behaviour of the agent, until it has learnt to function well in the environment.

In this tutorial, we use a very light version of reinforcement learning to teach an agent to predict what beats to play, based on the the beats it's hearing from another sequence, and from it's own memory.  The *environment* is the sequencing data that we are sending it from the audio engine.  The *agent* is a neural network, coupled with a *memory* that stores information from the environment. You can adjust the information that is available to the agent to guide its behaviour.  The *actions* are simple: the agent has two choices, (1) play a beat or (2) don't do anything.

When the agent is learning, we send it two sequences: (1) a sequence that it listens to (the *source*), (2) a second sequence, paired with the source sequence, that it must try to replicate (*the target*). For example if we send a kick sequence and a snare sequence, we can try and teach it to play the snare sequence based on what it hears from the kick sequence.  While learning, the agent tries to predict the next beat of the target sequence. If it gets it right, it receives a reward. If not, it receives a penalty.  The agent's behaviour optimises slowly while we send it sequences; this all happens in realtime, so that training the agent becomes a live performance by *you*, the teacher.

This tutorial will demonstrate how performative machine learning can be when training.  The sequences that you show to the agent, and the duration and order in which you play them, will have a significant effect on how the agent learns. As you train, you will pull the agents behaviour in different directions. Sometimes you can teach the agent multiple behaviours with different sequences. Sometimes you will pull it too far to one behaviour and it will forget the rest. Sometimes you will get some interesting surprises, other times disappointments. Over time, you'll get an intuitive feel for the training process.  

## The JS Code

The script in the JS window is a modified version of the script from Rubber Gosling.  It has some variables at the top which influence the behaviour of the agent. These are explained in the comments.  After configuring the script, run it and you can start livecoding. The script is a single block, so you just press ctrl-enter once.  If you want to restart your agent, just run the script again.

## The livecode window

The code in the livecode window is a framework for communicating with the RL model. It's based on what happens in the background in Rubber Gosling.  Some of the code sits between ```//---------------``` markers, indicating that this code shouldn't be edited.  

The workflow for training is as follows:

1. Switch the ```:mode:``` variable to ```2``` (off). This means that the audioengine will just ignore the RL agent.  Set up a pair of source and target sequences.
2. Switch the ```:mode:``` variable to ```0``` (learn). Watch the *loss* in the console
3. When ready, switch to prediction mode by changing the ```:mode:``` variable to ```1```. Now you can hear what the agent is doing.

Continue to adjust the agent's behaviour: you can go back to step 1 and create a new pair of sequences for it to learn.  As you train, keep trying out different source sequences to hear the agent's predictions.  Go back to sequences that it has heard before, and also try new ones.  Does it remember how to respond to what it heard before?  Have some of the rhythms changed because of new training data?

You can add in other sounds and sequences of your choosing to accompany the agent.
