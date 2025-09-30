<script>
// State object to track the selected options
// check has two props: on, true or false and changed a callback function
export let check
export let changed

function toggle(e) {
    check.on =  !check.on
    changed?.()
}
</script>

<style>
.main {
    display: inline-flex;
}

/* Hide the default checkbox */
input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    z-index:1;
}

/* Custom checkbox styling */
input[type="checkbox"] + span {
    position: relative;
    display: inline-block;
    width: 10px;
    height: 10px;
    background-color: var(--cNotSelected);
    border-radius: 5px;
    margin: 4px 0px 0px 4px;
}

/* Styling for the checked state */
input[type="checkbox"]:checked + span {
    background-color: var(--cSelected);
}
</style>
<div class="main">
    <input type="checkbox" checked={check.on} on:change={toggle} />
    <span></span>
</div>
  