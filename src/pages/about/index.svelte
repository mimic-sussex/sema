<div class="center-all">
  <div class="about">
    <div class="about-sema">
      <h2>
        about <span class='sema'>sema</span>
      </h2>
      <p>
        <span>
          Sema lets you compose and perform music in real time using simple live coding languages. It also enables you to customise these languages, create new ones, and infuse your live code with bespoke neural networks, using interactive workflows and small training data sets.
        </span>
      </p>
      <div class='iframe-container'>
        <iframe class='iframe'
                width="630" height="420"
                title="Sema-demo"
                src="https://www.youtube.com/embed/Qw4sYnTj-Ow?t=27s"
                >
        </iframe>
      </div>
      <p>
        <span>
        <span>
          Sema is a live coding environment for sound and music similar to SuperCollider, TidalCycles and Gibber.
        </span>
          Uniquely, it provides many domain-specific languages and an integrated experience to language design and machine learning in your Web browser. This is achieved through the integration of:
        </span>
      </p>
      <ul>
        <li>an interpreter for machine learning libraries (e.g. <a href="https://www.tensorflow.org/js/" target="_blank">tensorflow.js</a>) that lets you build and train neural networks</li>
        <li>a compiler for <a href="https://hardmath123.github.io/earley.html" target="_blank">BNF grammars</a> that enables you to customise or create live coding languages</li>
      </ul>
      <p>
        Do you need help with sema? Check the following:
      </p>
      <!-- <p> -->
        <ul>
          <li>articles and news in our <a href="https://blog.sema.codes" target="_blank">blog</a></li>
          <li>video tutorials on our Youtube <a href="https://www.youtube.com/channel/UCMJVYzJaZBNnKP6f0le7Lxg" target="_blank">channel</a></li>
          <li>issues on <a href="https://github.com/mimic-sussex/sema" target="_blank">Github</a></li>
          <li>talk to us on <a href="https://discord.gg/nNZMJfUHrS" target="_blank">Discord</a></li>
          <li>drop us an email at <a href="mailto://sema.live.coding@gmail.com" target="_blank">sema.live.coding@gmail.com</a></li>
        </ul>
      <!-- </p> -->
      <div class='image-container'>
        <img src="images/team/wac2019.jpg"
              alt="team"
              width="640" height="431" >
      </div>
      <p>
        <span>
          Sema is developed at the University of Sussex, with ❤️ and funding from two UKRI/AHRC grants 'MIMIC - Musically Intelligent Machines Interacting Collaboratively' and 'Innovating Sema'.
        </span>
        <span>
          It builds upon many amazing contributions of the open-source community, including <a href="https://svelte.dev/" target="_blank">Svelte</a>, <a href="https://routify.dev/" target="_blank">Routify</a>, <a href="https://nearley.js.org/" target="_blank">Nearley</a> and <a href="https://github.com/micknoise/Maximilian" target="_blank">Maximilian</a>.
        </span>
      </p>
      <p>

      </p>
    </div>

  </div>
</div>

<style>
  .about {
    width: 100vw;
    height: 100vh;
    color: #999999;
    overflow: scroll;
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr 4fr 1fr;
  }

  .about-sema {
    width: 100%;
    height: 100%;
    overflow: auto;
    grid-column: 2/2;
  }

  .sema-community {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  h2 {
    padding: 10px 20px 0px 20px;
  }

  p {
    padding: 10px 20px 0px 20px;
  }
  .sema {
    color: #FFFFFF;
  }

  .iframe {
    /* margin: 0 auto; */
  }

  .iframe-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .image-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>