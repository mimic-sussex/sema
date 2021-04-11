<script>
    import { tick, onMount } from 'svelte';
    import { url, params } from '@roxi/routify';
    import marked from 'marked';
    

    function handleClick(){
        console.log('AKSJDHKJASHDKJAHDS')
    //console.log('HERE!!!');
    }

</script>


<button on:click={handleClick}>
    clickme
</button>