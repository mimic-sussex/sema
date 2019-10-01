nearley-test ./eppprocessor.js --input 'osc tri (osc sin (osc sin (osc square (osc phasor 12 + osc saw 12))))'

[ { '@lang':
     [ { '@spawn':
          { '@synth':
             { '@func':
                { '@comp':
                   [ { '@osc': '@tri' },
                     { '@comp':
                        [ { '@osc': '@sin' },
                          { '@comp':
                             [ { '@osc': '@sin' },
                               { '@comp':
                                  [ { '@osc': '@square' },
                                    { '@add':
                                       [ { '@osc': '@pha', param: 12 }, { '@osc': '@saw', param: 12 } ] } ] } ] } ] } ] } } } } ] } ]