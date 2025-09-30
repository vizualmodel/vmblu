<script>
	import { onMount } from 'svelte';
	import { theme } from './theme.js';

	// box = {title, pos, ok, cancel, open, show, hide, update}
	export let box;

	// dragging behaviour
	let startX, startY, initialLeft, initialTop;
	let dragging = false;

	onMount(() => {
		// set the show, hide and update functions
		box.show = show;
		box.hide = hide;
		box.update = () => (box = box);
	});

	function onMouseDown(e) {
		startX = e.clientX;
		startY = e.clientY;
		initialLeft = box.div.offsetLeft;
		initialTop = box.div.offsetTop;
		dragging = true;

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(e) {
		if (dragging) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			box.div.style.left = `${initialLeft + dx}px`;
			box.div.style.top = `${initialTop + dy}px`;
		}
	}

	function onMouseUp(e) {
		dragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	function show(pos) {
		if (!pos) pos = box.pos;

		if (pos) {
			box.div.style.left = `${pos.x}px`;
			box.div.style.top = `${pos.y}px`;
		}
		box.div.style.display = 'block';
		box = box;
	}

	function hide() {
		box.div.style.display = 'none';
	}

	function onCancel(e) {
		hide();
		box.cancel?.(e);
	}

	function onOk(e) {
		hide();
		box.ok?.(e);
	}

	function onOpen(e) {
		box.open?.(e);
	}

	function onAdd(e) {
		box.add?.(e);
	}

	function onTrash(e) {
		hide();
		box.trash?.(e);
	}

	function onKeydown(e) {
		// prevent the keydown from having effects on the editor !
		e.stopPropagation();

		// check the key
		return e.key == "Enter" ? onOk(e)
			: (e.key == "Escape" || e.key == "Esc") ? onCancel(e)
			: null;
	}
</script>

<style>
.main {
    /* settings */
    --fontBase: arial, helvetica, sans-serif;
    --sFontHeader: 0.8rem;
    --rBox: 0.1rem;
    --sIcon: 1rem;

    /* Icon colors */
    --cOk: #3c913c;
    --cOkHover: #00ff00;
    --cCancel: #a52b2b;
    --cCancelHover: #ff0000;
    --cOpen: #c0c022;
    --cOpenHover: #ffff00;

    display: none;
    position: absolute;
    font-family: var(--fontBase);
    z-index: 1;
    overflow: auto;
    background-color: var(--bgBox);
    border: 1px solid var(--cBoxBorder);
    border-radius: var(--rBox);
    padding: 0.5rem;
}

.light {
    --bgBoxHeader: #ccc;
    --cBoxBorder: #000;
    --cBoxHeader: #000;
    --bgBox: #ccc;
}

.dark {
    --bgBoxHeader: #000;
    --cBoxBorder: #ccc;
    --cBoxHeader: yellow;
    --bgBox: #000;
}

/* Updated header style */
.hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bgBoxHeader);
    margin-bottom: 0.8rem;
}

/* Containers for left/right icons */
.left-icons,
.right-icons {
    display: flex;
    align-items: center;
}

/* Remove floats and control spacing via flex */
i {
    font-size: var(--sIcon);
    cursor: pointer;
    margin-right: 0.3rem;
}
i.check {
color:var(--cOk);
}
i.check:hover {
    color:var(--cOkHover);
}
i.cancel {
    color:var(--cCancel);
}
i.cancel:hover {
    color:var(--cCancelHover);
}
i.open {
    color: var(--cOpen);
}
i.open:hover {
    color: var(--cOpenHover);
}
i.trash {
    color: var(--cCancel);
}
i.trash:hover {
    color: var(--cCancelHover);
}

/* Optional: Adjust the trash icon margins if desired */
.right-icons i {
    margin-right: 0; /* override margin if needed */
}

h1 {
    flex-grow: 1;       /* take up the remaining space */
    text-align: center; /* center the title text */
    font-family: inherit;
    font-size: var(--sFontHeader);
    font-weight: normal;
    color: var(--cBoxHeader);
    margin: 0;          /* reset default margins */
}
</style>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="main {$theme}" bind:this={box.div} on:keydown={onKeydown}>
	<div class="hdr" on:mousedown={onMouseDown}>
		<!-- Left icons -->
		<div class="left-icons">
			<i class="material-icons-outlined cancel" on:click={onCancel} on:keydown={onKeydown}>cancel</i>
			<i class="material-icons-outlined check" on:click={onOk} on:keydown={onKeydown}>check_circle</i>
			{#if box.open}
				<i class="material-icons-outlined open" on:click={onOpen} on:keydown={onKeydown}>description</i>
			{/if}
			{#if box.add}
				<i class="material-icons-outlined open" on:click={onAdd} on:keydown={onKeydown}>add_circle</i>
			{/if}
		</div>

		<!-- Title -->
		<h1>{box.title}</h1>

		<!-- Right icon (delete/trash) -->
		{#if box.trash}
			<div class="right-icons">
				<i class="material-icons-outlined trash" on:click={onTrash} on:keydown={onKeydown}>delete</i>
			</div>
		{/if}
	</div>
	<slot/>
</div>
