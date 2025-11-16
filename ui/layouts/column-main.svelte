<script>
import {onMount} from 'svelte'
export let tx

let container
let leftColumn
let mainArea
let separator

let leftWidth = 0
let dragging = false
let pendingFrame = null
let resizeObserver

const DEFAULT_LEFT_RATIO = 0.12
const MIN_LEFT_WIDTH = 160
const MIN_MAIN_WIDTH = 320
const WINDOWLESS_WIDTH_FALLBACK = 1024
const hasWindow = typeof window !== 'undefined'

const requestFrame = (cb) => {
	if (hasWindow && typeof window.requestAnimationFrame === 'function') {
		return window.requestAnimationFrame(cb)
	}
	return setTimeout(() => cb(Date.now()), 16)
}

const cancelFrame = (handle) => {
	if (handle === null) return
	if (hasWindow && typeof window.cancelAnimationFrame === 'function') {
		window.cancelAnimationFrame(handle)
		return
	}
	clearTimeout(handle)
}

const scheduleMainAreaNotification = () => {
	if (pendingFrame !== null) return
	pendingFrame = requestFrame(() => {
		pendingFrame = null
		sendMainAreaSize()
	})
}

const clampLeftWidth = (width) => {
	const viewportWidth = hasWindow ? window.innerWidth : WINDOWLESS_WIDTH_FALLBACK
	const total = container?.clientWidth ?? viewportWidth ?? width
	if (!total) return width
	const minCandidate = Math.max(total - MIN_MAIN_WIDTH, 80)
	const min = Math.min(MIN_LEFT_WIDTH, minCandidate)
	const max = Math.max(total - MIN_MAIN_WIDTH, min)
	const limited = Math.min(Math.max(width, min), max)
	return Number.isFinite(limited) ? limited : min
}

const stopDragging = () => {
	if (!dragging) return
	dragging = false
	if (hasWindow) {
		window.removeEventListener('pointermove', handlePointerMove)
		window.removeEventListener('pointerup', handlePointerUp)
	}
	separator?.classList.remove('dragging')
	sendMainAreaSize()
}

const handlePointerMove = (event) => {
	if (!dragging || !container) return
	const {left} = container.getBoundingClientRect()
	const proposed = clampLeftWidth(event.clientX - left)
	if (proposed !== leftWidth) {
		leftWidth = proposed
		scheduleMainAreaNotification()
	}
}

const handlePointerUp = () => stopDragging()

const startDragging = (event) => {
	event.preventDefault()
	dragging = true
	separator?.classList.add('dragging')
	if (hasWindow) {
		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
	}
}

const handleWindowResize = () => {
	leftWidth = clampLeftWidth(leftWidth)
	scheduleMainAreaNotification()
}

const sendMainAreaSize = () => {
	if (!mainArea || !tx) return
	const rect = mainArea.getBoundingClientRect()
	const payload = {
		rect: {
			x: 0,
			y: 0,
			w: Math.floor(rect.width),
			h: Math.floor(rect.height),
		},
	}
	tx.send('size change', payload)
}

onMount(() => {
	const viewportWidth = hasWindow ? window.innerWidth : WINDOWLESS_WIDTH_FALLBACK
	const total = container?.clientWidth ?? viewportWidth ?? 0
	leftWidth = clampLeftWidth(total * DEFAULT_LEFT_RATIO || MIN_LEFT_WIDTH)

	if (hasWindow) {
		window.addEventListener('resize', handleWindowResize)
	}

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => scheduleMainAreaNotification())
		if (mainArea) resizeObserver.observe(mainArea)
	}

	// notify once the DOM settled
	scheduleMainAreaNotification()

	return () => {
		if (hasWindow) {
			window.removeEventListener('resize', handleWindowResize)
		}
		stopDragging()
		resizeObserver?.disconnect()
		if (pendingFrame !== null) {
			cancelFrame(pendingFrame)
			pendingFrame = null
		}
	}
})

export const handlers = {
	onLeftColumn(div) {
		leftColumn?.replaceChildren(div)
	},

	onMainArea(div) {
		if (!mainArea) return
		mainArea.replaceChildren(div)

		div.width = Math.floor(mainArea.clientWidth)
		div.height = Math.floor(mainArea.clientHeight)

		sendMainAreaSize()
	},
}
</script>
<style>
:global(html, body) {
	width: 100%;
	height: 100%;
	margin: 0;
	padding: 0;
	overflow: hidden;
}

.column-main-layout {
	display: flex;
	width: 100vw;
	height: 100vh;
	background-color: #1b1f23;
	color: #f3f3f3;
}

.left-column {
	flex: 0 0 auto;
	height: 100%;
	background-color: #272b30;
	overflow: hidden;
}

.separator {
	width: 6px;
	cursor: ew-resize;
	background-color: #3b3f45;
	transition: background-color 0.15s ease;
}

.separator:hover,
.separator.dragging {
	background-color: #4aa3d5;
}

.main-area {
	flex: 1 1 auto;
	height: 100%;
	background-color: #555;
	overflow: hidden;
}
</style>
<div class="column-main-layout" bind:this={container}>
	<div
		class="left-column"
		bind:this={leftColumn}
		style={`width:${leftWidth}px;flex-basis:${leftWidth}px;`}
	></div>
	<div
		class="separator"
		bind:this={separator}
		on:pointerdown={startDragging}
	></div>
	<div class="main-area" bind:this={mainArea}></div>
</div>
