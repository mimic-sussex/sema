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
let markdown = marked(source);
</script>

<style>

  .markdown-container {
    overflow: auto;
    margin-left: 10px;
    margin-right: 10px;
    margin-bottom: 10px;
    border: solid 5px #aaaaaa;
    border-radius: 5px;
    height: 85vh;
    background: #aaaaaa;
  }

  .markdown-output {
    /* width: 100%; */
    padding: 0 1em;
  }

</style>

<div class="markdown-container">
  <div class="markdown-output">{@html markdown}</div>
</div>
