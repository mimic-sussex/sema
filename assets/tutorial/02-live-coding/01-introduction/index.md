# Introduction to live coding with the default language

Sema allows you to make or customise your own livecoding languages.  We provide the default language, which allows you to access all the functions in the signal engine. This set of tutorials guides you through the basic features.  In this tutorial, you can copy and paste the code examples into the live coding window.

In the default language, commands take the format

{parameter, parameter, ...}function;

Let's begin with a simple saw oscillator; paste this code into the live coding window, and press ctrl-enter to run it.

```
> {100}saw;
```
