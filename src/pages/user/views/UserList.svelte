<script>
  export let userList;
</script>

<style>
  .container {
    margin-left:1em;
    margin-right:1em;
  }

  .userlist-container{
    margin-top:1em;
    overflow-y: auto;
  }
</style>

<div class='container'>
  <h1>Sema User Directory</h1>
  <span>Click a username to view their profile.</span>

  <div class='userlist-container'>
    {#if userList}
      <ul>
      {#each userList as user}
        <li><a href="{`user/${user.username}`}" >{user.username}</a></li>
      {/each}
      </ul>
    {/if}
  </div>

</div>