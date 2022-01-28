# Variables

In the default language, variables optionally begin and always end with a ```:``` symbol, for example ```:mysound:``` or ```mysound:```.

To store a value in a variable, simply put the variable to the left of a function to capture the result. To read from a variable, use it as a parameter to a function.

In this example, a a variable is created in each line and then used in the following line


```
:speed:{{0.2}saw,0.1,20}blin;
:freq:{{:speed:}tri, 20,200}blin;
>{:freq:}sqr;
```

In this example, four oscillators are created and mixed in the last lines

```
:osc1:{102}sawn;
:osc2:{201}sawn;
:osc3:{199}sawn;
:osc4:{150}sawn;
>{:osc1:, :osc2:, :osc3:, :osc4:}mix;
```

A variable can be placed at any point in a statement, not just at the beginning

```
:all:{:osc1:{102}sawn,:osc2:{103}sawn}mix;
>{:osc1:,10}dist;
```
