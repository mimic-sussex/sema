<script>

import marked from 'marked';

let source = `
# H1 heading

## H2 heading

### H3 heading

---

**bold text**

*italicized text*

---

1. First item
2. Second item
3. Third item

- First item
- Second item
- Third item

[Sema](https://sema.codes/)
# H1 heading

## H2 heading

### H3 heading

---

**bold text**

*italicized text*

---

1. First item
2. Second item
3. Third item

- First item
- Second item
- Third item

[Sema](https://sema.codes/)


`;

let renderer = new marked.Renderer();
renderer.link = function(href, title, text) {
    let link = marked.Renderer.prototype.link.apply(this, arguments);
    return link.replace("<a","<a target='_blank'");
};

marked.setOptions({
    renderer: renderer
});


let markdown = marked(source);
console.log(markdown);
</script>

<style>


  .markdown-output {
    /* width: 100%; */
    padding: 0 0.2em;
    -moz-user-select: text;
    -khtml-user-select: text;
    -webkit-user-select: text;
    -ms-user-select: text;
    user-select: text;
  }

</style>


<div class="markdown-output">{@html markdown}</div>

