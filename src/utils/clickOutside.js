/** Dispatch event on click outside of node */

//excluded should contain an array of id's to be excluded from registering as a 'click_outside' event if it occurs.
// dont have to pass excluded if its not needed.
export function clickOutside(node, excluded) {
  
  const handleClick = event => {

    if (node && !node.contains(event.target) && !event.defaultPrevented) {

      if (excluded) {
        for (let i=0; i<excluded.length; i++){
          console.log('exlcuded', excluded[i])
          if (event.explicitOriginalTarget.id != excluded[i]){
            
            node.dispatchEvent(
              new CustomEvent('click_outside', node)
            )
          
          }
        }
      } else {
        node.dispatchEvent(
          new CustomEvent('click_outside', node)
        )
      }
    }
  }

	document.addEventListener('click', handleClick, true);
  
  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
	}
} 