<script>

let treeHeadings = []; //to store the headers scraped from each markdown file
let doc = 'default-livecoding-language'; //set to default to start with


//navigate the route to based on the heading
function navigateToSection(heading){
    //$goto(parent )
    return 0;
  }

  function findHeadings(text){
    let tokens = marked.lexer(text);
    //loop through them
    for (let i=0; i<tokens.length; i++){
      //console.log(tokens[i])
      if (tokens[i].type == "heading" && tokens[i].depth == 1){
        //console.log(tokens[i]);
        treeHeadings.append(tokens.text);
      }
    }
  }

  
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
  
  console.log(treeHeadings)


</script>


<!--
<ul class='sidebar-menu'>
    {#each links as {path, name, file}, i}
      <a  href={$url(path)}
          class:active={$isActive(path)}
          on:click={handleClick(active)}
          >
        {name}
      </a><br><br>


      {#each treeHeadings as heading}
        <a href={$url(active + '#' + heading)} 
            class:active={$isActive(active + '#' + heading)}
            on:click={navigateToSection(heading)}
            >
          {heading}
        </a><br>
      {/each}


    {/each}
</ul>
-->