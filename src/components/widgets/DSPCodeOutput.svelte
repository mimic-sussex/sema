<script>
import { dspCode } from '../../stores/common.js'
import beautify from 'js-beautify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);
// export let items;

let beautifyOptions = {
  "indent_size": "2",
  "indent_char": " ",
  "max_preserve_newlines": "1",
  "preserve_newlines": true,
  "keep_array_indentation": true,
  "break_chained_methods": true,
  "indent_scripts": "normal",
  "brace_style": "collapse",
  "space_in_empty_paren": true,
  "space_before_conditional": true,
  "unescape_strings": true,
  "jslint_happy": false,
  "end_with_newline": false,
  "wrap_line_length": "70",
  "indent_inner_html": false,
  "comma_first": true,
  "e4x": false,
  "indent_empty_lines": false
};



</script>


<style>

  .container-dsp-code-output {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    font-family: monospace;
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}


  .prewrap {
    display: inline-flexbox;
    width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word;
    margin:5px 0px 15px 5px;

    -moz-user-select: text;
    -khtml-user-select: text;
    -webkit-user-select: text;
    -ms-user-select: text;
    user-select: text;
  }
  .error-state {
    color:red;
    margin: 25px 10px 5px 10px;
  }

  .headline {
    overflow-y: scroll; height:auto;
    margin-top: 6px;
    margin-left: 20px;
    margin-bottom: 10px;
  }


</style>

<div class='container-dsp-code-output scrollable'>
  <div class="headline">
    <strong>DSP CODE OUTPUT</strong>
  </div>
  {#if $dspCode}
  <strong class="error-state">Setup:</strong>
  <pre class='prewrap'> { beautify($dspCode.setup, beautifyOptions)  } </pre>
  <strong class="error-state">Loop:</strong>
  <pre class='prewrap'> { beautify($dspCode.loop, beautifyOptions) } </pre>
  <!-- <pre> { JSON.stringify($dspCode.loop, null, 2) } </pre> -->
  {/if}
</div>