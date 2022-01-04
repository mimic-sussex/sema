<script>
  export let userList;
</script>

<h1>Sema users</h1>
<span>Click a username to view their profile.</span>
<br>

{#if userList}
  <ul>
  {#each userList as user}
    <li><a href="{`user/${user.username}`}" >{user.username}</a></li>
  {/each}
  </ul>
{/if}