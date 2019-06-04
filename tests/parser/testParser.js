var chai = require('chai');
var expect = chai.expect;
var should = chai.should();
const nearley = require("nearley");
const processor = require("../nearlIXIprocessor.js");



describe('parse_non_null_mode_input', function () {

  it('it should generate an non-null IXI AST for the melodic mode input', function () {

    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(processor));
    var input = "joe -> fle[1 3 45 67 2]";

    parser.feed(input);

    parser.results.should.not.equal(null);
  });

  it('it should generate an non-null IXI AST for the percussive mode input', function () {

    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(processor));
    var input = "perc -> |x xo xox xox|";

    parser.feed(input);

    parser.results.should.not.equal(null);
  });

  it('it should generate an non-null IXI AST for the concrete mode input', function () {

    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(processor));
    var input = "connie -> marimba{1 3 45 67 2}!";

    parser.feed(input);

    parser.results.should.not.equal(null);
  });

});