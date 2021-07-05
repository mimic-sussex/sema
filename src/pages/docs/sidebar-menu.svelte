<script>

  import { getContext } from 'svelte';
  import { url, params } from "@roxi/routify";
  import marked from 'marked';

  let treeHeadings = []; //to store the headers scraped from each markdown file
  let doc = 'default-language'
  //get headings to display in the sidebar
  let getHeadings = async (doc) => {



    if(doc != undefined){ // There is a call with undefined value when navigating to Playground
      const res = await fetch(document.location.origin + `/docs/${doc}.md`)
      const text = await res.text();
      // await tick();
      if (res.ok) {
        //get tokens from the marked lexer
        let tokens = marked.lexer(text);
        
        //loop through them
        for (let i=0; i<tokens.length; i++){
          //console.log(tokens[i])
          if (tokens[i].type == "heading" && tokens[i].depth == 1){
            //console.log(tokens[i]);
            treeHeadings.push(tokens[i].text.replace(/\s+/g, '-').toLowerCase());
          }
        }

        //console.log(tokens[0]);
      } else {
        throw new Error(text);
      }
    }
  }
  
  getHeadings('default-language');
  console.log('threeheadings', treeHeadings)

  const links = getContext('links');
  let submenus = [];
  
  function populateSubMenus(){
    console.log('asdasd');
  }

</script>


<style>
  .sidebar-sub-menu {
    color: grey;
  }
</style>
