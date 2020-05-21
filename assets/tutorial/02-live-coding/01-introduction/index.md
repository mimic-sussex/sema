# Introduction to live coding with the default language

Sema allows you to make or customise your own livecoding languages.  We provide the default language, which allows you to access all the functions in the signal engine. This set of tutorials guides you through the basic features.  In this tutorial, you can copy and paste the code examples into the live coding window.

In the default language, commands take the format

```
{parameter, parameter, ...}function;
```

Let's begin with a simple saw oscillator; paste this code into the live coding window, and press cmd-Enter [Mac] OR ctrl-Enter [Windows/Linux] to run it.

```
> {100}saw;
```

This instruction tells sema to play a saw wave at 100 Hz.  The `>` symbol indicates where we should listen to the sound output.


A parameter can also be another function:

```
> {{100}saw, {101}saw}mix;
```

this mixes two saw waves together, slightly detuned.

The default language is a simple functional language, and this is the basic syntax.  Follow the tutorials below to explore more features.
