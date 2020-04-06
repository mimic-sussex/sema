//js - Echo state network (tfjs)
var esn = {};
esn.N = 10;
esn.NOut = 1;
esn.x = tf.randomUniform([esn.N,1]);
esn.res = tf.randomNormal([esn.N, esn.N],0, 1.9);
esn.wout = tf.randomUniform([esn.NOut,esn.N]);
esn.output = tf.zeros([esn.Nout])
esn.leakRate = tf.scalar(0.5);
esn.leakRateInv = tf.sub(tf.scalar(1.0), esn.leakRate);
esn.leakRateInv.dataSync()
esn.xold = tf.clone(esn.x);

esn.calc = () => {
 tf.tidy(() => {
     tf.dispose(esn.xold);
     esn.xold = esn.x;
     let xnew =  tf.matMul(esn.res, esn.x);
     xnew = tf.add(tf.mul(tf.tanh(xnew), esn.leakRate), tf.mul(tf.tanh(esn.xold), esn.leakRateInv));
     esn.x = tf.keep(xnew);
     let newOutput = tf.keep(tf.matMul(esn.wout, esn.x));
     tf.dispose(esn.output);
     esn.output = tf.keep(newOutput);
     return 0;
 });
};
__________
esn.calc()
esn.output.dataSync()
//esn.res.dataSync()
__________
next = () => {return 0;}
__________
next = () => {
   esn.calc()
   return ((esn.output.dataSync()[0] + 1) * 100) + 100;
}
__________
