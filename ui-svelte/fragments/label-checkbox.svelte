<script>
import CheckBox from './checkbox.svelte'

export let label
export let on
export let style = 'width: 9rem;'
export let onToggle
</script>

<style>
.label-checkbox {
    display: flex;
    align-items: center;
    margin: 0rem 0rem 0.3rem 0rem;
    background: transparent;
}

label {
    font-family: var(--fFamily);
    color: #ccc;
    font-size: var(--fSmall);
    background: transparent;
    user-select: none;
}

.checkbox-field {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-left: 1rem;
}

.checkbox-field :global(input[type="checkbox"]) {
    margin-left: 0;
}
</style>

<div class="label-checkbox">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label style={style}>{label}</label>
    <div class="checkbox-field">
        <CheckBox bind:on onToggle={onToggle} />
        <slot/>
    </div>
</div>
