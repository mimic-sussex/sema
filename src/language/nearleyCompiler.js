import * as nearley from 'nearley/lib/nearley.js';
import * as grammar from './eppprocessor';

// const nearley = require("nearley");
// const compile = require("nearley/lib/compile");
// const generate = require("nearley/lib/generate");
// const nearleyGrammar = require("nearley/lib/nearley-language-bootstrapped");


function compileGrammar(sourceCode) {
    // Parse the grammar source into an AST
    const grammarParser = new nearley.Parser(nearleyGrammar);
    grammarParser.feed(sourceCode);
    const grammarAst = grammarParser.results[0]; // TODO check for errors

    // Compile the AST into a set of rules
    const grammarInfoObject = compile(grammarAst, {});
    // Generate JavaScript code from the rules
    const grammarJs = generate(grammarInfoObject, "grammar");

    // Pretend this is a CommonJS environment to catch exports from the grammar.
    const module = { exports: {} };
    eval(grammarJs);

    return module.exports;
}


const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

export { parser };
