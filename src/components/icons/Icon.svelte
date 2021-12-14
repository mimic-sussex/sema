<script>
  // import { KeyIcon, MailIcon, InboxIcon, LogInIcon } from 'svelte-feather-icons'
  import Spinner from './loading-icons/Spinner.svelte'

  const map = {
    spinner: Spinner
  }

  export let name
  export let size = 10

</script>

<svelte:component this={map[name]} {size}/>
