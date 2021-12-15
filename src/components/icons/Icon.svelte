<script>
  // import { KeyIcon, MailIcon, InboxIcon, LogInIcon } from 'svelte-feather-icons'
  import Spinner from './loading-icons/Spinner.svelte'
  import ButtonHorizontal from './static-icons/ButtonHorizontal.svelte'
  const map = {
    spinner: Spinner,
    buttonHorizontal: ButtonHorizontal
  }

  export let name
  export let size = 10

</script>

<svelte:component this={map[name]} {size}/>
