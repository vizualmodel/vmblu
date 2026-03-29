/** @returns {void} */
function noop() {}

/**
 * @template T
 * @template S
 * @param {T} tar
 * @param {S} src
 * @returns {T & S}
 */
function assign(tar, src) {
	// @ts-ignore
	for (const k in src) tar[k] = src[k];
	return /** @type {T & S} */ (tar);
}

function run(fn) {
	return fn();
}

function blank_object() {
	return Object.create(null);
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
function run_all(fns) {
	fns.forEach(run);
}

/**
 * @param {any} thing
 * @returns {thing is Function}
 */
function is_function(thing) {
	return typeof thing === 'function';
}

/** @returns {boolean} */
function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}

/** @returns {boolean} */
function is_empty(obj) {
	return Object.keys(obj).length === 0;
}

function subscribe(store, ...callbacks) {
	if (store == null) {
		for (const callback of callbacks) {
			callback(undefined);
		}
		return noop;
	}
	const unsub = store.subscribe(...callbacks);
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

/** @returns {void} */
function component_subscribe(component, store, callback) {
	component.$$.on_destroy.push(subscribe(store, callback));
}

function create_slot(definition, ctx, $$scope, fn) {
	if (definition) {
		const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
		return definition[0](slot_ctx);
	}
}

function get_slot_context(definition, ctx, $$scope, fn) {
	return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
}

function get_slot_changes(definition, $$scope, dirty, fn) {
	if (definition[2] && fn) {
		const lets = definition[2](fn(dirty));
		if ($$scope.dirty === undefined) {
			return lets;
		}
		if (typeof lets === 'object') {
			const merged = [];
			const len = Math.max($$scope.dirty.length, lets.length);
			for (let i = 0; i < len; i += 1) {
				merged[i] = $$scope.dirty[i] | lets[i];
			}
			return merged;
		}
		return $$scope.dirty | lets;
	}
	return $$scope.dirty;
}

/** @returns {void} */
function update_slot_base(
	slot,
	slot_definition,
	ctx,
	$$scope,
	slot_changes,
	get_slot_context_fn
) {
	if (slot_changes) {
		const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
		slot.p(slot_context, slot_changes);
	}
}

/** @returns {any[] | -1} */
function get_all_dirty_from_scope($$scope) {
	if ($$scope.ctx.length > 32) {
		const dirty = [];
		const length = $$scope.ctx.length / 32;
		for (let i = 0; i < length; i++) {
			dirty[i] = -1;
		}
		return dirty;
	}
	return -1;
}

function null_to_empty(value) {
	return value == null ? '' : value;
}

/**
 * @param {Node} target
 * @param {Node} node
 * @returns {void}
 */
function append(target, node) {
	target.appendChild(node);
}

/**
 * @param {Node} target
 * @param {Node} node
 * @param {Node} [anchor]
 * @returns {void}
 */
function insert(target, node, anchor) {
	target.insertBefore(node, anchor || null);
}

/**
 * @param {Node} node
 * @returns {void}
 */
function detach(node) {
	if (node.parentNode) {
		node.parentNode.removeChild(node);
	}
}

/**
 * @returns {void} */
function destroy_each(iterations, detaching) {
	for (let i = 0; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].d(detaching);
	}
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} name
 * @returns {HTMLElementTagNameMap[K]}
 */
function element(name) {
	return document.createElement(name);
}

/**
 * @param {string} data
 * @returns {Text}
 */
function text(data) {
	return document.createTextNode(data);
}

/**
 * @returns {Text} */
function space() {
	return text(' ');
}

/**
 * @returns {Text} */
function empty() {
	return text('');
}

/**
 * @param {EventTarget} node
 * @param {string} event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
 * @returns {() => void}
 */
function listen(node, event, handler, options) {
	node.addEventListener(event, handler, options);
	return () => node.removeEventListener(event, handler, options);
}

/**
 * @param {Element} node
 * @param {string} attribute
 * @param {string} [value]
 * @returns {void}
 */
function attr(node, attribute, value) {
	if (value == null) node.removeAttribute(attribute);
	else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}

/**
 * @param {Element} element
 * @returns {ChildNode[]}
 */
function children(element) {
	return Array.from(element.childNodes);
}

/**
 * @param {Text} text
 * @param {unknown} data
 * @returns {void}
 */
function set_data(text, data) {
	data = '' + data;
	if (text.data === data) return;
	text.data = /** @type {string} */ (data);
}

/**
 * @returns {void} */
function set_input_value(input, value) {
	input.value = value == null ? '' : value;
}

/**
 * @returns {void} */
function set_style(node, key, value, important) {
	if (value == null) {
		node.style.removeProperty(key);
	} else {
		node.style.setProperty(key, value, '');
	}
}

/**
 * @typedef {Node & {
 * 	claim_order?: number;
 * 	hydrate_init?: true;
 * 	actual_end_child?: NodeEx;
 * 	childNodes: NodeListOf<NodeEx>;
 * }} NodeEx
 */

/** @typedef {ChildNode & NodeEx} ChildNodeEx */

/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

/**
 * @typedef {ChildNodeEx[] & {
 * 	claim_info?: {
 * 		last_index: number;
 * 		total_claimed: number;
 * 	};
 * }} ChildNodeArray
 */

let current_component;

/** @returns {void} */
function set_current_component(component) {
	current_component = component;
}

function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
 *
 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs/svelte#onmount
 * @template T
 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];

let render_callbacks = [];

const flush_callbacks = [];

const resolved_promise = /* @__PURE__ */ Promise.resolve();

let update_scheduled = false;

/** @returns {void} */
function schedule_update() {
	if (!update_scheduled) {
		update_scheduled = true;
		resolved_promise.then(flush);
	}
}

/** @returns {void} */
function add_render_callback(fn) {
	render_callbacks.push(fn);
}

/** @returns {void} */
function add_flush_callback(fn) {
	flush_callbacks.push(fn);
}

// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();

let flushidx = 0; // Do *not* move this inside the flush() function

/** @returns {void} */
function flush() {
	// Do not reenter flush while dirty components are updated, as this can
	// result in an infinite loop. Instead, let the inner flush handle it.
	// Reentrancy is ok afterwards for bindings etc.
	if (flushidx !== 0) {
		return;
	}
	const saved_component = current_component;
	do {
		// first, call beforeUpdate functions
		// and update components
		try {
			while (flushidx < dirty_components.length) {
				const component = dirty_components[flushidx];
				flushidx++;
				set_current_component(component);
				update(component.$$);
			}
		} catch (e) {
			// reset dirty state to not end up in a deadlocked state and then rethrow
			dirty_components.length = 0;
			flushidx = 0;
			throw e;
		}
		set_current_component(null);
		dirty_components.length = 0;
		flushidx = 0;
		while (binding_callbacks.length) binding_callbacks.pop()();
		// then, once components are updated, call
		// afterUpdate functions. This may cause
		// subsequent updates...
		for (let i = 0; i < render_callbacks.length; i += 1) {
			const callback = render_callbacks[i];
			if (!seen_callbacks.has(callback)) {
				// ...so guard against infinite loops
				seen_callbacks.add(callback);
				callback();
			}
		}
		render_callbacks.length = 0;
	} while (dirty_components.length);
	while (flush_callbacks.length) {
		flush_callbacks.pop()();
	}
	update_scheduled = false;
	seen_callbacks.clear();
	set_current_component(saved_component);
}

/** @returns {void} */
function update($$) {
	if ($$.fragment !== null) {
		$$.update();
		run_all($$.before_update);
		const dirty = $$.dirty;
		$$.dirty = [-1];
		$$.fragment && $$.fragment.p($$.ctx, dirty);
		$$.after_update.forEach(add_render_callback);
	}
}

/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 * @param {Function[]} fns
 * @returns {void}
 */
function flush_render_callbacks(fns) {
	const filtered = [];
	const targets = [];
	render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
	targets.forEach((c) => c());
	render_callbacks = filtered;
}

const outroing = new Set();

/**
 * @type {Outro}
 */
let outros;

/**
 * @returns {void} */
function group_outros() {
	outros = {
		r: 0,
		c: [],
		p: outros // parent group
	};
}

/**
 * @returns {void} */
function check_outros() {
	if (!outros.r) {
		run_all(outros.c);
	}
	outros = outros.p;
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} [local]
 * @returns {void}
 */
function transition_in(block, local) {
	if (block && block.i) {
		outroing.delete(block);
		block.i(local);
	}
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} local
 * @param {0 | 1} [detach]
 * @param {() => void} [callback]
 * @returns {void}
 */
function transition_out(block, local, detach, callback) {
	if (block && block.o) {
		if (outroing.has(block)) return;
		outroing.add(block);
		outros.c.push(() => {
			outroing.delete(block);
			if (callback) {
				if (detach) block.d(1);
				callback();
			}
		});
		block.o(local);
	} else if (callback) {
		callback();
	}
}

/** @typedef {1} INTRO */
/** @typedef {0} OUTRO */
/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

/**
 * @typedef {Object} Outro
 * @property {number} r
 * @property {Function[]} c
 * @property {Object} p
 */

/**
 * @typedef {Object} PendingProgram
 * @property {number} start
 * @property {INTRO|OUTRO} b
 * @property {Outro} [group]
 */

/**
 * @typedef {Object} Program
 * @property {number} a
 * @property {INTRO|OUTRO} b
 * @property {1|-1} d
 * @property {number} duration
 * @property {number} start
 * @property {number} end
 * @property {Outro} [group]
 */

// general each functions:

function ensure_array_like(array_like_or_iterator) {
	return array_like_or_iterator?.length !== undefined
		? array_like_or_iterator
		: Array.from(array_like_or_iterator);
}

/** @returns {void} */
function bind(component, name, callback) {
	const index = component.$$.props[name];
	if (index !== undefined) {
		component.$$.bound[index] = callback;
		callback(component.$$.ctx[index]);
	}
}

/** @returns {void} */
function create_component(block) {
	block && block.c();
}

/** @returns {void} */
function mount_component(component, target, anchor) {
	const { fragment, after_update } = component.$$;
	fragment && fragment.m(target, anchor);
	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
		// if the component was destroyed immediately
		// it will update the `$$.on_destroy` reference to `null`.
		// the destructured on_destroy may still reference to the old array
		if (component.$$.on_destroy) {
			component.$$.on_destroy.push(...new_on_destroy);
		} else {
			// Edge case - component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});
	after_update.forEach(add_render_callback);
}

/** @returns {void} */
function destroy_component(component, detaching) {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		flush_render_callbacks($$.after_update);
		run_all($$.on_destroy);
		$$.fragment && $$.fragment.d(detaching);
		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}

/** @returns {void} */
function make_dirty(component, i) {
	if (component.$$.dirty[0] === -1) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty.fill(0);
	}
	component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
}

// TODO: Document the other params
/**
 * @param {SvelteComponent} component
 * @param {import('./public.js').ComponentConstructorOptions} options
 *
 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
 * This will be the `add_css` function from the compiled component.
 *
 * @returns {void}
 */
function init(
	component,
	options,
	instance,
	create_fragment,
	not_equal,
	props,
	append_styles = null,
	dirty = [-1]
) {
	const parent_component = current_component;
	set_current_component(component);
	/** @type {import('./private.js').T$$} */
	const $$ = (component.$$ = {
		fragment: null,
		ctx: [],
		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),
		// lifecycle
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
		// everything else
		callbacks: blank_object(),
		dirty,
		skip_bound: false,
		root: options.target || parent_component.$$.root
	});
	append_styles && append_styles($$.root);
	let ready = false;
	$$.ctx = instance
		? instance(component, options.props || {}, (i, ret, ...rest) => {
				const value = rest.length ? rest[0] : ret;
				if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
					if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
					if (ready) make_dirty(component, i);
				}
				return ret;
		  })
		: [];
	$$.update();
	ready = true;
	run_all($$.before_update);
	// `false` as a special case of no DOM component
	$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
	if (options.target) {
		if (options.hydrate) {
			// TODO: what is the correct type here?
			// @ts-expect-error
			const nodes = children(options.target);
			$$.fragment && $$.fragment.l(nodes);
			nodes.forEach(detach);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment && $$.fragment.c();
		}
		if (options.intro) transition_in(component.$$.fragment);
		mount_component(component, options.target, options.anchor);
		flush();
	}
	set_current_component(parent_component);
}

/**
 * Base class for Svelte components. Used when dev=false.
 *
 * @template {Record<string, any>} [Props=any]
 * @template {Record<string, any>} [Events=any]
 */
class SvelteComponent {
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$ = undefined;
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$set = undefined;

	/** @returns {void} */
	$destroy() {
		destroy_component(this, 1);
		this.$destroy = noop;
	}

	/**
	 * @template {Extract<keyof Events, string>} K
	 * @param {K} type
	 * @param {((e: Events[K]) => void) | null | undefined} callback
	 * @returns {() => void}
	 */
	$on(type, callback) {
		if (!is_function(callback)) {
			return noop;
		}
		const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
		callbacks.push(callback);
		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	/**
	 * @param {Partial<Props>} props
	 * @returns {void}
	 */
	$set(props) {
		if (this.$$set && !is_empty(props)) {
			this.$$.skip_bound = true;
			this.$$set(props);
			this.$$.skip_bound = false;
		}
	}
}

/**
 * @typedef {Object} CustomElementPropDefinition
 * @property {string} [attribute]
 * @property {boolean} [reflect]
 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
 */

// generated during release, do not modify

const PUBLIC_VERSION = '4';

if (typeof window !== 'undefined')
	// @ts-ignore
	(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

/* nodes\menu-tabs-window\menu-tabs-window.svelte generated by Svelte v4.2.20 */

function create_fragment$v(ctx) {
	let div3;
	let div0;
	let t0;
	let div1;
	let t1;
	let div2;

	return {
		c() {
			div3 = element("div");
			div0 = element("div");
			div0.innerHTML = ``;
			t0 = space();
			div1 = element("div");
			div1.innerHTML = ``;
			t1 = space();
			div2 = element("div");
			attr(div0, "class", "menu svelte-1xg9j2");
			attr(div1, "class", "tabs svelte-1xg9j2");
			attr(div2, "class", "content svelte-1xg9j2");
			attr(div3, "class", "main svelte-1xg9j2");
		},
		m(target, anchor) {
			insert(target, div3, anchor);
			append(div3, div0);
			/*div0_binding*/ ctx[6](div0);
			append(div3, t0);
			append(div3, div1);
			/*div1_binding*/ ctx[7](div1);
			append(div3, t1);
			append(div3, div2);
			/*div2_binding*/ ctx[8](div2);
			/*div3_binding*/ ctx[9](div3);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div3);
			}

			/*div0_binding*/ ctx[6](null);
			/*div1_binding*/ ctx[7](null);
			/*div2_binding*/ ctx[8](null);
			/*div3_binding*/ ctx[9](null);
		}
	};
}

function instance$v($$self, $$props, $$invalidate) {
	let { tx } = $$props;
	let mainDiv;
	let contentDiv;
	let menuDiv;
	let tabsDiv;

	onMount(async () => {
		
	});

	const handlers = {
		"-> content div"(div) {
			// replace the content
			contentDiv.replaceChildren(div);

			// send out the div
			tx.send('div', mainDiv);
		},
		"-> menu div"(div) {
			menuDiv.replaceChildren(div);
		},
		"-> tabs div"(div) {
			tabsDiv.replaceChildren(div);
		},
		"-> modal div"(div) {
			mainDiv.append(div);
		},
		"-> size change"({ id, rect }) {
			const w = Math.floor(contentDiv.clientWidth);
			const h = Math.floor(contentDiv.clientHeight);
			tx.send("content size change", { x: 0, y: 0, w, h });
		},
		"-> show"() {
			tx.send('div', mainDiv);
		}
	};

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			menuDiv = $$value;
			$$invalidate(2, menuDiv);
		});
	}

	function div1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			tabsDiv = $$value;
			$$invalidate(3, tabsDiv);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			contentDiv = $$value;
			$$invalidate(1, contentDiv);
		});
	}

	function div3_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			mainDiv = $$value;
			$$invalidate(0, mainDiv);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(4, tx = $$props.tx);
	};

	return [
		mainDiv,
		contentDiv,
		menuDiv,
		tabsDiv,
		tx,
		handlers,
		div0_binding,
		div1_binding,
		div2_binding,
		div3_binding
	];
}

class Menu_tabs_window extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$v, create_fragment$v, safe_not_equal, { tx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

/* nodes\canvas-layout\canvas-layout.svelte generated by Svelte v4.2.20 */

function create_fragment$u(ctx) {
	let div5;

	return {
		c() {
			div5 = element("div");
			div5.innerHTML = `<div id="main-grid" class="svelte-jgeogz"><div id="menu-box" class="svelte-jgeogz"></div> <div id="tab-box" class="svelte-jgeogz"></div> <div id="left-box" class="svelte-jgeogz"></div> <div id="center-box" class="svelte-jgeogz"></div></div>`;
			attr(div5, "id", "page-content");
			attr(div5, "class", "svelte-jgeogz");
		},
		m(target, anchor) {
			insert(target, div5, anchor);
			/*div5_binding*/ ctx[3](div5);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div5);
			}

			/*div5_binding*/ ctx[3](null);
		}
	};
}

function setTheme$1(theme) {
	// always include the common class name
	document.documentElement.className = theme + " common";

	localStorage.setItem('vza-theme', theme);
}

function getTheme$1() {
	const theme = localStorage.getItem('vza-theme');
	theme ? setTheme$1(theme) : setTheme$1('dark');
}

function instance$u($$self, $$props, $$invalidate) {
	let { tx } = $$props;

	// the page content div
	let pageContent;

	// when mounting
	onMount(async () => {
		// get the selected colortheme - default to dark
		getTheme$1();
	});

	const handlers = {
		"-> menu"(div) {
			pageContent.querySelector("#menu-box")?.append(div);
		},
		"-> tab ribbon"(div) {
			pageContent.querySelector("#tab-box")?.append(div);
		},
		"-> workspace"(div) {
			pageContent.querySelector("#left-box")?.append(div);
		},
		"-> canvas"(canvas) {
			pageContent.querySelector("#center-box")?.append(canvas);

			// note that the context of a canvas gets reset when the size changes !
			canvas.width = Math.floor(canvas.parentElement.clientWidth);

			canvas.height = Math.floor(canvas.parentElement.clientHeight);

			// send a message that the canvas size has been adapted
			tx.send("canvas size change", {
				rect: {
					x: 0,
					y: 0,
					w: canvas.width,
					h: canvas.height
				}
			});
		},
		"-> modal div"(div) {
			pageContent.querySelector("#center-box")?.append(div);
		}
	};

	function div5_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			pageContent = $$value;
			$$invalidate(0, pageContent);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(1, tx = $$props.tx);
	};

	return [pageContent, tx, handlers, div5_binding];
}

class Canvas_layout extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$u, create_fragment$u, safe_not_equal, { tx: 1, handlers: 2 });
	}

	get handlers() {
		return this.$$.ctx[2];
	}
}

/* nodes\left-menu-layout\left-menu-layout.svelte generated by Svelte v4.2.20 */

function create_fragment$t(ctx) {
	let div7;
	let div6;
	let div0;
	let t0;
	let div1;
	let t1;
	let div2;
	let t2;
	let div3;
	let t3;
	let div4;
	let t4;
	let div5;
	let mounted;
	let dispose;

	return {
		c() {
			div7 = element("div");
			div6 = element("div");
			div0 = element("div");
			t0 = space();
			div1 = element("div");
			t1 = space();
			div2 = element("div");
			t2 = space();
			div3 = element("div");
			t3 = space();
			div4 = element("div");
			t4 = space();
			div5 = element("div");
			attr(div0, "id", "left-menu");
			attr(div0, "class", "svelte-1ew5eoh");
			attr(div1, "id", "left-column");
			attr(div1, "class", "svelte-1ew5eoh");
			attr(div2, "id", "sep-col");
			attr(div2, "class", "svelte-1ew5eoh");
			attr(div3, "id", "area-one");
			attr(div3, "class", "svelte-1ew5eoh");
			attr(div4, "id", "sep-area");
			attr(div4, "class", "svelte-1ew5eoh");
			attr(div5, "id", "area-two");
			attr(div5, "class", "svelte-1ew5eoh");
			attr(div6, "id", "main-grid");
			attr(div6, "class", "svelte-1ew5eoh");
			attr(div7, "id", "page-content");
			attr(div7, "class", "svelte-1ew5eoh");
		},
		m(target, anchor) {
			insert(target, div7, anchor);
			append(div7, div6);
			append(div6, div0);
			/*div0_binding*/ ctx[13](div0);
			append(div6, t0);
			append(div6, div1);
			/*div1_binding*/ ctx[14](div1);
			append(div6, t1);
			append(div6, div2);
			/*div2_binding*/ ctx[15](div2);
			append(div6, t2);
			append(div6, div3);
			/*div3_binding*/ ctx[16](div3);
			append(div6, t3);
			append(div6, div4);
			/*div4_binding*/ ctx[17](div4);
			append(div6, t4);
			append(div6, div5);
			/*div5_binding*/ ctx[18](div5);
			/*div6_binding*/ ctx[19](div6);

			if (!mounted) {
				dispose = [
					listen(div2, "mousedown", /*sepColMouseDown*/ ctx[8]),
					listen(div4, "mousedown", /*sepAreaMouseDown*/ ctx[7]),
					listen(div6, "mousemove", /*gridMouseMove*/ ctx[10]),
					listen(div6, "mouseup", /*gridMouseUp*/ ctx[9])
				];

				mounted = true;
			}
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div7);
			}

			/*div0_binding*/ ctx[13](null);
			/*div1_binding*/ ctx[14](null);
			/*div2_binding*/ ctx[15](null);
			/*div3_binding*/ ctx[16](null);
			/*div4_binding*/ ctx[17](null);
			/*div5_binding*/ ctx[18](null);
			/*div6_binding*/ ctx[19](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function setTheme(theme) {
	// always include the common class name
	document.documentElement.className = theme + " common";

	localStorage.setItem('vza-theme', theme);
}

function getTheme() {
	const theme = localStorage.getItem('vza-theme');
	theme ? setTheme(theme) : setTheme('dark');
}

function instance$t($$self, $$props, $$invalidate) {
	let { tx } = $$props;

	// the page content div
	let mainGrid;

	let leftMenu;
	let leftCol;
	let sepCol;
	let sepArea;
	let areaOne;
	let areaTwo;

	// when mounting
	onMount(() => {
		// get the selected colortheme - default to dark
		getTheme();
	});

	// the grid status
	const state = {
		dragging: false,
		sepColDrag: false, // dragging left column separator
		sepAreaDrag: false, // dragging area separator
		horizontal: true
	};

	// vertical config
	const vGrid = {
		rows: "100%",
		get cols() {
			const wCol = leftCol.getBoundingClientRect().width;
			return `30px ${wCol}px 6px 50% 6px calc(50% - 42px)`;
		},
		areas: "'lme lco spc ar1 spa ar2'"
	};

	// horizontal config
	const hGrid = {
		rows: "50vh 6px auto",
		get cols() {
			const wCol = leftCol.getBoundingClientRect().width;
			return `30px ${wCol}px 6px auto`;
		},
		areas: "'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2'"
	};

	// fullscreen config == horizontal with zero for area1
	const fsGrid = {
		rows: "100% 0px 0px",
		get cols() {
			const wCol = leftCol.getBoundingClientRect().width;
			return `30px ${wCol}px 6px auto`;
		},
		areas: "'lme lco spc ar1' 'lme lco spc spa' 'lme lco spc ar2'"
	};

	const handlers = {
		"-> left menu"(div) {
			leftMenu.replaceChildren(div);
		},
		"-> left column"(div) {
			leftCol.replaceChildren(div);
		},
		"-> area one"(div) {
			// replace the current pane (if any)
			areaOne.replaceChildren(div);

			// note that the context of a canvas gets reset when the size changes !
			div.width = Math.floor(areaOne.clientWidth);

			div.height = Math.floor(areaOne.clientHeight);

			// send a message that the canvas size has been adapted
			tx.send("size change", {
				id: 'area-one',
				rect: { x: 0, y: 0, w: div.width, h: div.height }
			});
		},
		"-> area two"(div) {
			// if the second pane is not visible, make it visible
			if (areaTwo.clientWidth == 0 || areaTwo.clientHeight == 0) {
				if (state.horizontal) gridConfig(hGrid.rows, hGrid.cols, hGrid.areas); else gridConfig(vGrid.rows, vGrid.cols, vGrid.areas);
			}

			// replace the current pane (if any)
			areaTwo.replaceChildren(div);

			// note that the context of a canvas gets reset when the size changes !
			div.width = Math.floor(areaTwo.clientWidth);

			div.height = Math.floor(areaTwo.clientHeight);

			// send a message that the canvas size has been adapted
			tx.send("size change", {
				id: 'area-two',
				rect: { x: 0, y: 0, w: div.width, h: div.height }
			});
		},
		"-> vertical"() {
			// if horizontal go to vertical - else go to full screen
			if (state.horizontal) {
				gridConfig(vGrid.rows, vGrid.cols, vGrid.areas);
				state.horizontal = false;
			} else {
				gridConfig(fsGrid.rows, fsGrid.cols, fsGrid.areas);
			}

			// set the cursor
			$$invalidate(4, sepArea.style.cursor = state.horizontal ? 'ns-resize' : 'ew-resize', sepArea);

			// and signal the change of area size
			areaSizeChange();
		},
		"-> horizontal"() {
			// check if fullscreen
			if (!state.horizontal || areaOne.clientHeight == 0 || areaTwo.clientHeight == 0) gridConfig(hGrid.rows, hGrid.cols, hGrid.areas); else gridConfig(fsGrid.rows, fsGrid.cols, fsGrid.areas);

			// full screen is also horizontal
			state.horizontal = true;

			// set the cursor
			$$invalidate(4, sepArea.style.cursor = 'ns-resize', sepArea);

			// and signal the change of area size
			areaSizeChange();
		}
	};

	function gridConfig(rows, columns, areas) {
		// adjust the grid settings
		$$invalidate(0, mainGrid.style.gridTemplateRows = rows, mainGrid);

		$$invalidate(0, mainGrid.style.gridTemplateColumns = columns, mainGrid);
		$$invalidate(0, mainGrid.style.gridTemplateAreas = areas, mainGrid);
	}

	function clearDrag() {
		state.dragging = false;
		state.sepColDrag = false;
		state.sepAreaDrag = false;
	}

	// disable pointer events for the panes
	function disablePointerEvents() {
		if (areaOne?.style) $$invalidate(5, areaOne.style.pointerEvents = "none", areaOne);
		if (areaTwo?.style) $$invalidate(6, areaTwo.style.pointerEvents = "none", areaTwo);
	}

	// enable pointer events for the panes
	function enablePointerEvents() {
		if (areaOne?.style) $$invalidate(5, areaOne.style.pointerEvents = "auto", areaOne);
		if (areaTwo?.style) $$invalidate(6, areaTwo.style.pointerEvents = "auto", areaTwo);
	}

	// mouse down is only captured on the separator.
	// mouse move and mouse up are captured over the entire grid - so a check on dragging is required
	// when dragging the mouse events for the iframe are disabled, otherwise the grid does not get the mouse events
	function sepAreaMouseDown(e) {
		// set the state
		state.dragging = true;

		// set the type of separator
		state.sepAreaDrag = true;

		// disbale pointer events
		disablePointerEvents();
	}

	function sepColMouseDown(e) {
		// set the state
		state.dragging = true;

		// set the separator
		state.sepColDrag = true;

		// disbale pointer events
		disablePointerEvents();
	}

	function gridMouseUp(e) {
		// check
		if (!state.dragging) return;

		// change state 
		clearDrag();

		// enable pointer events
		enablePointerEvents();

		// canvas size has changed
		areaSizeChange();
	}

	function sepColDrag(dx) {
		const rcAreaOne = areaOne.getBoundingClientRect();
		const rcLeftCol = leftCol.getBoundingClientRect();
		$$invalidate(0, mainGrid.style.gridTemplateColumns = `30px ${rcLeftCol.width + dx}px 6px ${rcAreaOne.width - dx}px 6px auto`, mainGrid);
	}

	function hSepAreaDrag(dy) {
		const rcAreaOne = areaOne.getBoundingClientRect();
		$$invalidate(0, mainGrid.style.gridTemplateRows = `${rcAreaOne.height + dy}px 6px auto`, mainGrid);
	}

	function vSepAreaDrag(dx) {
		const rcAreaOne = areaOne.getBoundingClientRect();
		const rcLeftCol = leftCol.getBoundingClientRect();
		$$invalidate(0, mainGrid.style.gridTemplateColumns = `30px ${rcLeftCol.width}px 6px ${rcAreaOne.width + dx}px 6px auto`, mainGrid);
	}

	function gridMouseMove(e) {
		// check
		if (!state.dragging) return;

		if (state.sepAreaDrag) {
			state.horizontal
			? hSepAreaDrag(e.movementY)
			: vSepAreaDrag(e.movementX);
		} else if (state.sepColDrag) sepColDrag(e.movementX);
	}

	function areaSizeChange() {
		// first box
		if (areaOne.hasChildNodes()) {
			const rect = {
				x: 0,
				y: 0,
				w: areaOne.clientWidth,
				h: areaOne.clientHeight
			};

			tx.send("size change", { id: 'area-one', rect });
		}

		// second box
		if (areaTwo.hasChildNodes()) {
			const rect = {
				x: 0,
				y: 0,
				w: areaTwo.clientWidth,
				h: areaTwo.clientHeight
			};

			tx.send("size change", { id: 'area-two', rect });
		}
	}

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			leftMenu = $$value;
			$$invalidate(1, leftMenu);
		});
	}

	function div1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			leftCol = $$value;
			$$invalidate(2, leftCol);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			sepCol = $$value;
			$$invalidate(3, sepCol);
		});
	}

	function div3_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			areaOne = $$value;
			$$invalidate(5, areaOne);
		});
	}

	function div4_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			sepArea = $$value;
			$$invalidate(4, sepArea);
		});
	}

	function div5_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			areaTwo = $$value;
			$$invalidate(6, areaTwo);
		});
	}

	function div6_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			mainGrid = $$value;
			$$invalidate(0, mainGrid);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(11, tx = $$props.tx);
	};

	return [
		mainGrid,
		leftMenu,
		leftCol,
		sepCol,
		sepArea,
		areaOne,
		areaTwo,
		sepAreaMouseDown,
		sepColMouseDown,
		gridMouseUp,
		gridMouseMove,
		tx,
		handlers,
		div0_binding,
		div1_binding,
		div2_binding,
		div3_binding,
		div4_binding,
		div5_binding,
		div6_binding
	];
}

class Left_menu_layout extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$t, create_fragment$t, safe_not_equal, { tx: 11, handlers: 12 }, null, [-1, -1]);
	}

	get handlers() {
		return this.$$.ctx[12];
	}
}

/* nodes\column-main\column-main.svelte generated by Svelte v4.2.20 */

function create_fragment$s(ctx) {
	let div3;
	let div0;
	let div0_style_value;
	let t0;
	let div1;
	let t1;
	let div2;
	let mounted;
	let dispose;

	return {
		c() {
			div3 = element("div");
			div0 = element("div");
			t0 = space();
			div1 = element("div");
			t1 = space();
			div2 = element("div");
			attr(div0, "class", "left-column svelte-r7atyp");
			attr(div0, "style", div0_style_value = `width:${/*leftWidth*/ ctx[4]}px;flex-basis:${/*leftWidth*/ ctx[4]}px;`);
			attr(div1, "class", "separator svelte-r7atyp");
			attr(div2, "class", "main-area svelte-r7atyp");
			attr(div3, "class", "column-main-layout svelte-r7atyp");
		},
		m(target, anchor) {
			insert(target, div3, anchor);
			append(div3, div0);
			/*div0_binding*/ ctx[8](div0);
			append(div3, t0);
			append(div3, div1);
			/*div1_binding*/ ctx[9](div1);
			append(div3, t1);
			append(div3, div2);
			/*div2_binding*/ ctx[10](div2);
			/*div3_binding*/ ctx[11](div3);

			if (!mounted) {
				dispose = listen(div1, "pointerdown", /*startDragging*/ ctx[5]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*leftWidth*/ 16 && div0_style_value !== (div0_style_value = `width:${/*leftWidth*/ ctx[4]}px;flex-basis:${/*leftWidth*/ ctx[4]}px;`)) {
				attr(div0, "style", div0_style_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div3);
			}

			/*div0_binding*/ ctx[8](null);
			/*div1_binding*/ ctx[9](null);
			/*div2_binding*/ ctx[10](null);
			/*div3_binding*/ ctx[11](null);
			mounted = false;
			dispose();
		}
	};
}

const DEFAULT_LEFT_RATIO = 0.12;
const MIN_LEFT_WIDTH = 160;
const MIN_MAIN_WIDTH = 320;
const WINDOWLESS_WIDTH_FALLBACK = 1024;

function instance$s($$self, $$props, $$invalidate) {
	let { tx } = $$props;
	let container;
	let leftColumn;
	let mainArea;
	let separator;
	let leftWidth = 0;
	let dragging = false;
	let pendingFrame = null;
	let resizeObserver;
	const hasWindow = typeof window !== 'undefined';

	const requestFrame = cb => {
		if (hasWindow && typeof window.requestAnimationFrame === 'function') {
			return window.requestAnimationFrame(cb);
		}

		return setTimeout(() => cb(Date.now()), 16);
	};

	const cancelFrame = handle => {
		if (handle === null) return;

		if (hasWindow && typeof window.cancelAnimationFrame === 'function') {
			window.cancelAnimationFrame(handle);
			return;
		}

		clearTimeout(handle);
	};

	const scheduleMainAreaNotification = () => {
		if (pendingFrame !== null) return;

		pendingFrame = requestFrame(() => {
			pendingFrame = null;
			sendMainAreaSize();
		});
	};

	const clampLeftWidth = width => {
		const viewportWidth = hasWindow
		? window.innerWidth
		: WINDOWLESS_WIDTH_FALLBACK;

		const total = container?.clientWidth ?? viewportWidth ?? width;
		if (!total) return width;
		const minCandidate = Math.max(total - MIN_MAIN_WIDTH, 80);
		const min = Math.min(MIN_LEFT_WIDTH, minCandidate);
		const max = Math.max(total - MIN_MAIN_WIDTH, min);
		const limited = Math.min(Math.max(width, min), max);
		return Number.isFinite(limited) ? limited : min;
	};

	const stopDragging = () => {
		if (!dragging) return;
		dragging = false;

		if (hasWindow) {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		}

		separator?.classList.remove('dragging');
		sendMainAreaSize();
	};

	const handlePointerMove = event => {
		if (!dragging || !container) return;
		const { left } = container.getBoundingClientRect();
		const proposed = clampLeftWidth(event.clientX - left);

		if (proposed !== leftWidth) {
			$$invalidate(4, leftWidth = proposed);
			scheduleMainAreaNotification();
		}
	};

	const handlePointerUp = () => stopDragging();

	const startDragging = event => {
		event.preventDefault();
		dragging = true;
		separator?.classList.add('dragging');

		if (hasWindow) {
			window.addEventListener('pointermove', handlePointerMove);
			window.addEventListener('pointerup', handlePointerUp);
		}
	};

	const handleWindowResize = () => {
		$$invalidate(4, leftWidth = clampLeftWidth(leftWidth));
		scheduleMainAreaNotification();
	};

	const sendMainAreaSize = () => {
		if (!mainArea || !tx) return;
		const rect = mainArea.getBoundingClientRect();

		const payload = {
			rect: {
				x: 0,
				y: 0,
				w: Math.floor(rect.width),
				h: Math.floor(rect.height)
			}
		};

		tx.send('size change', payload);
	};

	onMount(() => {
		const viewportWidth = hasWindow
		? window.innerWidth
		: WINDOWLESS_WIDTH_FALLBACK;

		const total = container?.clientWidth ?? viewportWidth ?? 0;
		$$invalidate(4, leftWidth = clampLeftWidth(total * DEFAULT_LEFT_RATIO || MIN_LEFT_WIDTH));

		if (hasWindow) {
			window.addEventListener('resize', handleWindowResize);
		}

		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => scheduleMainAreaNotification());
			if (mainArea) resizeObserver.observe(mainArea);
		}

		// notify once the DOM settled
		scheduleMainAreaNotification();

		return () => {
			if (hasWindow) {
				window.removeEventListener('resize', handleWindowResize);
			}

			stopDragging();
			resizeObserver?.disconnect();

			if (pendingFrame !== null) {
				cancelFrame(pendingFrame);
				pendingFrame = null;
			}
		};
	});

	const handlers = {
		onLeftColumn(div) {
			leftColumn?.replaceChildren(div);
		},
		onMainArea(div) {
			if (!mainArea) return;
			mainArea.replaceChildren(div);
			div.width = Math.floor(mainArea.clientWidth);
			div.height = Math.floor(mainArea.clientHeight);
			sendMainAreaSize();
		}
	};

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			leftColumn = $$value;
			$$invalidate(1, leftColumn);
		});
	}

	function div1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			separator = $$value;
			$$invalidate(3, separator);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			mainArea = $$value;
			$$invalidate(2, mainArea);
		});
	}

	function div3_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			container = $$value;
			$$invalidate(0, container);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(6, tx = $$props.tx);
	};

	return [
		container,
		leftColumn,
		mainArea,
		separator,
		leftWidth,
		startDragging,
		tx,
		handlers,
		div0_binding,
		div1_binding,
		div2_binding,
		div3_binding
	];
}

class Column_main extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$s, create_fragment$s, safe_not_equal, { tx: 6, handlers: 7 });
	}

	get handlers() {
		return this.$$.ctx[7];
	}
}

/* nodes\top-menu\top-menu.svelte generated by Svelte v4.2.20 */

function get_each_context$8(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	child_ctx[9] = i;
	return child_ctx;
}

// (90:4) {#each symbols as symbol, index}
function create_each_block$8(ctx) {
	let div1;
	let i;
	let t0_value = /*symbol*/ ctx[7].name + "";
	let t0;
	let t1;
	let div0;
	let t2_value = /*symbol*/ ctx[7].help + "";
	let t2;
	let t3;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			i = element("i");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");
			t2 = text(t2_value);
			t3 = space();
			attr(i, "class", "material-icons-outlined icon svelte-15nacvn");
			attr(i, "data-index", /*index*/ ctx[9]);
			attr(div0, "class", "tooltip svelte-15nacvn");
			set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			attr(div1, "class", "menu-item svelte-15nacvn");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, i);
			append(i, t0);
			append(div1, t1);
			append(div1, div0);
			append(div0, t2);
			append(div1, t3);

			if (!mounted) {
				dispose = [listen(i, "click", /*menuClick*/ ctx[2]), listen(i, "keydown", keydown$2)];
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*symbols*/ 2 && t0_value !== (t0_value = /*symbol*/ ctx[7].name + "")) set_data(t0, t0_value);
			if (dirty & /*symbols*/ 2 && t2_value !== (t2_value = /*symbol*/ ctx[7].help + "")) set_data(t2, t2_value);

			if (dirty & /*symbols*/ 2) {
				set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$r(ctx) {
	let div;
	let each_value = ensure_array_like(/*symbols*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$8(get_each_context$8(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "menu svelte-15nacvn");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			/*div_binding*/ ctx[6](div);
		},
		p(ctx, [dirty]) {
			if (dirty & /*symbols, menuClick, keydown*/ 6) {
				each_value = ensure_array_like(/*symbols*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$8(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$8(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[6](null);
		}
	};
}

function keydown$2() {
	
}

function instance$r($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	onMount(() => {
		// send the div
		tx.send("div", menuDiv);
	});

	let menuDiv = null;
	let symbols = sx ?? [];

	const handlers = {
		// The menu can be changed
		"-> set menu"(newSymbols) {
			$$invalidate(1, symbols = newSymbols);
		}
	};

	function menuClick(e) {
		// get the clicked symbol
		const index = e.target.getAttribute("data-index");

		// send the corresponding message
		tx.send(symbols[index].message, e);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			menuDiv = $$value;
			$$invalidate(0, menuDiv);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(4, sx = $$props.sx);
	};

	return [menuDiv, symbols, menuClick, tx, sx, handlers, div_binding];
}

class Top_menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$r, create_fragment$r, safe_not_equal, { tx: 3, sx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

/* nodes\side-menu\side-menu.svelte generated by Svelte v4.2.20 */

function get_each_context$7(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	child_ctx[9] = i;
	return child_ctx;
}

// (85:4) {#each symbols as symbol, index}
function create_each_block$7(ctx) {
	let div1;
	let i;
	let t0_value = /*symbol*/ ctx[7].name + "";
	let t0;
	let t1;
	let div0;
	let t2_value = /*symbol*/ ctx[7].help + "";
	let t2;
	let t3;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			i = element("i");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");
			t2 = text(t2_value);
			t3 = space();
			attr(i, "class", "material-icons-outlined icon svelte-1st5yi2");
			attr(i, "data-index", /*index*/ ctx[9]);
			attr(div0, "class", "tooltip svelte-1st5yi2");
			set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			attr(div1, "class", "menu-item svelte-1st5yi2");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, i);
			append(i, t0);
			append(div1, t1);
			append(div1, div0);
			append(div0, t2);
			append(div1, t3);

			if (!mounted) {
				dispose = [listen(i, "click", /*menuClick*/ ctx[2]), listen(i, "keydown", keydown$1)];
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*symbols*/ 2 && t0_value !== (t0_value = /*symbol*/ ctx[7].name + "")) set_data(t0, t0_value);
			if (dirty & /*symbols*/ 2 && t2_value !== (t2_value = /*symbol*/ ctx[7].help + "")) set_data(t2, t2_value);

			if (dirty & /*symbols*/ 2) {
				set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$q(ctx) {
	let div;
	let each_value = ensure_array_like(/*symbols*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$7(get_each_context$7(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "menu svelte-1st5yi2");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			/*div_binding*/ ctx[6](div);
		},
		p(ctx, [dirty]) {
			if (dirty & /*symbols, menuClick, keydown*/ 6) {
				each_value = ensure_array_like(/*symbols*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$7(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$7(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[6](null);
		}
	};
}

function keydown$1() {
	
}

function instance$q($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	onMount(() => {
		// send the div
		tx.send("div", menuDiv);
	});

	let menuDiv = null;
	let symbols = sx ?? [];

	const handlers = {
		// The menu can be changed
		"-> set menu"(newSymbols) {
			$$invalidate(1, symbols = newSymbols);
		}
	};

	function menuClick(e) {
		// get the clicked symbol
		const index = e.target.getAttribute("data-index");

		// send the corresponding message
		tx.send(symbols[index].message, e);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			menuDiv = $$value;
			$$invalidate(0, menuDiv);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(4, sx = $$props.sx);
	};

	return [menuDiv, symbols, menuClick, tx, sx, handlers, div_binding];
}

class Side_menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$q, create_fragment$q, safe_not_equal, { tx: 3, sx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

/* nodes\tab-ribbon\tab-ribbon.svelte generated by Svelte v4.2.20 */

function get_each_context$6(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i];
	child_ctx[8] = i;
	return child_ctx;
}

// (181:8) {:else}
function create_else_block$3(ctx) {
	let div1;
	let t0_value = /*tab*/ ctx[6] + "";
	let t0;
	let t1;
	let input;
	let t2;
	let div0;
	let t3_value = /*tab*/ ctx[6] + "";
	let t3;
	let t4;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			t0 = text(t0_value);
			t1 = space();
			input = element("input");
			t2 = space();
			div0 = element("div");
			t3 = text(t3_value);
			t4 = space();
			attr(input, "class", "button svelte-14ugtii");
			attr(input, "type", "button");
			attr(div0, "class", "full-name svelte-14ugtii");
			set_style(div0, "width", /*tab*/ ctx[6].length * 0.5 + "rem");
			attr(div1, "class", "tab svelte-14ugtii");
			attr(div1, "data-index", /*index*/ ctx[8]);
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, t0);
			append(div1, t1);
			append(div1, input);
			append(div1, t2);
			append(div1, div0);
			append(div0, t3);
			append(div1, t4);

			if (!mounted) {
				dispose = [
					listen(input, "click", /*onClose*/ ctx[2]),
					listen(input, "keydown", onKeydown$5),
					listen(div1, "click", /*onClick*/ ctx[1]),
					listen(div1, "keydown", onKeydown$5)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*ribbon*/ 1 && t0_value !== (t0_value = /*tab*/ ctx[6] + "")) set_data(t0, t0_value);
			if (dirty & /*ribbon*/ 1 && t3_value !== (t3_value = /*tab*/ ctx[6] + "")) set_data(t3, t3_value);

			if (dirty & /*ribbon*/ 1) {
				set_style(div0, "width", /*tab*/ ctx[6].length * 0.5 + "rem");
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (175:8) {#if index == ribbon.selected}
function create_if_block$6(ctx) {
	let div1;
	let t0_value = /*tab*/ ctx[6] + "";
	let t0;
	let t1;
	let input;
	let t2;
	let div0;
	let t3_value = /*tab*/ ctx[6] + "";
	let t3;
	let t4;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			t0 = text(t0_value);
			t1 = space();
			input = element("input");
			t2 = space();
			div0 = element("div");
			t3 = text(t3_value);
			t4 = space();
			attr(input, "class", "button svelte-14ugtii");
			attr(input, "type", "button");
			attr(div0, "class", "full-name svelte-14ugtii");
			set_style(div0, "width", /*tab*/ ctx[6].length * 0.5 + "rem");
			attr(div1, "class", "tab selected svelte-14ugtii");
			attr(div1, "data-index", /*index*/ ctx[8]);
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, t0);
			append(div1, t1);
			append(div1, input);
			append(div1, t2);
			append(div1, div0);
			append(div0, t3);
			append(div1, t4);

			if (!mounted) {
				dispose = [
					listen(input, "click", /*onClose*/ ctx[2]),
					listen(input, "keydown", onKeydown$5),
					listen(div1, "click", /*onClick*/ ctx[1]),
					listen(div1, "keydown", onKeydown$5)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*ribbon*/ 1 && t0_value !== (t0_value = /*tab*/ ctx[6] + "")) set_data(t0, t0_value);
			if (dirty & /*ribbon*/ 1 && t3_value !== (t3_value = /*tab*/ ctx[6] + "")) set_data(t3, t3_value);

			if (dirty & /*ribbon*/ 1) {
				set_style(div0, "width", /*tab*/ ctx[6].length * 0.5 + "rem");
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (174:4) {#each ribbon.tabs as tab, index}
function create_each_block$6(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*index*/ ctx[8] == /*ribbon*/ ctx[0].selected) return create_if_block$6;
		return create_else_block$3;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_block.d(detaching);
		}
	};
}

function create_fragment$p(ctx) {
	let div;
	let each_value = ensure_array_like(/*ribbon*/ ctx[0].tabs);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$6(get_each_context$6(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "tab-ribbon svelte-14ugtii");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			/*div_binding*/ ctx[5](div);
		},
		p(ctx, [dirty]) {
			if (dirty & /*onClick, onKeydown, ribbon, onClose*/ 7) {
				each_value = ensure_array_like(/*ribbon*/ ctx[0].tabs);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$6(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$6(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[5](null);
		}
	};
}

function onKeydown$5(e) {
	
}

function instance$p($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	onMount(() => {
		tx.send("div", ribbon.div);
	});

	// The tabs
	let ribbon = { div: null, selected: -1, tabs: [] };

	const handlers = {
		onTabNew(name) {
			$$invalidate(0, ribbon.selected = ribbon.tabs.push(name) - 1, ribbon);
			$$invalidate(0, ribbon);
		},
		onTabRemove(name) {
			// notation
			const tabs = ribbon.tabs;

			// remove the tab with the name
			const L = tabs.length;

			for (let i = 0; i < L; i++) {
				if (tabs[i] == name) {
					if (L > 1) for (let j = i; j < L - 1; j++) tabs[j] = tabs[j + 1];
					tabs.pop();
					break;
				}
			}

			$$invalidate(0, ribbon);
		},
		onTabRename({ oldName, newName }) {
			// notation
			const tabs = ribbon.tabs;

			const index = tabs.findIndex(tab => tab == oldName);
			if (index >= 0) tabs[index] = newName;
			$$invalidate(0, ribbon);
		},
		onTabSelect(name) {
			// notation
			const tabs = ribbon.tabs;

			const index = tabs.findIndex(tab => tab == name);
			if (index >= 0) $$invalidate(0, ribbon.selected = index, ribbon);
			$$invalidate(0, ribbon);
		}
	};

	// Event Functions 
	function onClick(e) {
		// get the uid of the tab clicked
		const index = e.target.getAttribute("data-index");

		if (index < 0 || index >= ribbon.tabs.length) return;
		tx.send("tab request to select", ribbon.tabs[index]);
	}

	function onClose(e) {
		// no propagation
		e.stopPropagation();

		// get the uid of the tab clicked
		const index = e.target.parentNode.getAttribute("data-index");

		if (index < 0 || index >= ribbon.tabs.length) return;
		tx.send("tab request to close", ribbon.tabs[index]);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			ribbon.div = $$value;
			$$invalidate(0, ribbon);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
	};

	return [ribbon, onClick, onClose, tx, handlers, div_binding];
}

class Tab_ribbon extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$p, create_fragment$p, safe_not_equal, { tx: 3, handlers: 4 });
	}

	get handlers() {
		return this.$$.ctx[4];
	}
}

/* nodes\vscode-side-menu\vscode-side-menu.svelte generated by Svelte v4.2.20 */

function get_each_context$5(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	child_ctx[9] = i;
	return child_ctx;
}

// (90:4) {#each symbols as symbol, index}
function create_each_block$5(ctx) {
	let div1;
	let i;
	let t0_value = /*symbol*/ ctx[7].icon + "";
	let t0;
	let t1;
	let div0;
	let t2_value = /*symbol*/ ctx[7].help + "";
	let t2;
	let t3;
	let mounted;
	let dispose;

	return {
		c() {
			div1 = element("div");
			i = element("i");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");
			t2 = text(t2_value);
			t3 = space();
			attr(i, "class", "material-icons-outlined icon svelte-13h6ctb");
			set_style(i, "color", /*symbol*/ ctx[7].color);
			attr(i, "data-index", /*index*/ ctx[9]);
			attr(div0, "class", "tooltip svelte-13h6ctb");
			set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			attr(div1, "class", "menu-item svelte-13h6ctb");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, i);
			append(i, t0);
			append(div1, t1);
			append(div1, div0);
			append(div0, t2);
			append(div1, t3);

			if (!mounted) {
				dispose = [listen(i, "click", /*menuClick*/ ctx[2]), listen(i, "keydown", keydown)];
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*symbols*/ 2 && t0_value !== (t0_value = /*symbol*/ ctx[7].icon + "")) set_data(t0, t0_value);

			if (dirty & /*symbols*/ 2) {
				set_style(i, "color", /*symbol*/ ctx[7].color);
			}

			if (dirty & /*symbols*/ 2 && t2_value !== (t2_value = /*symbol*/ ctx[7].help + "")) set_data(t2, t2_value);

			if (dirty & /*symbols*/ 2) {
				set_style(div0, "width", /*symbol*/ ctx[7].help.length * 0.5 + "rem");
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$o(ctx) {
	let div;
	let each_value = ensure_array_like(/*symbols*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "menu svelte-13h6ctb");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			/*div_binding*/ ctx[6](div);
		},
		p(ctx, [dirty]) {
			if (dirty & /*symbols, menuClick, keydown*/ 6) {
				each_value = ensure_array_like(/*symbols*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$5(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$5(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[6](null);
		}
	};
}

function keydown(e) {
	
}

function instance$o($$self, $$props, $$invalidate) {
	let { tx, sx } = $$props;

	// this.menu
	let floatingDiv;

	let symbols = sx;

	onMount(() => {
		// send the div
		tx.send("div", floatingDiv);
	});

	const handlers = {
		"-> set menu"(newSymbols) {
			$$invalidate(1, symbols = newSymbols);
		}
	};

	function menuClick(e) {
		const index = e.target.getAttribute("data-index");
		if (symbols[index].message?.length > 0) tx.send(symbols[index].message, e);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			floatingDiv = $$value;
			$$invalidate(0, floatingDiv);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
		if ('sx' in $$props) $$invalidate(4, sx = $$props.sx);
	};

	return [floatingDiv, symbols, menuClick, tx, sx, handlers, div_binding];
}

class Vscode_side_menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$o, create_fragment$o, safe_not_equal, { tx: 3, sx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

const subscriber_queue = [];

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 *
 * https://svelte.dev/docs/svelte-store#writable
 * @template T
 * @param {T} [value] initial value
 * @param {import('./public.js').StartStopNotifier<T>} [start]
 * @returns {import('./public.js').Writable<T>}
 */
function writable(value, start = noop) {
	/** @type {import('./public.js').Unsubscriber} */
	let stop;
	/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
	const subscribers = new Set();
	/** @param {T} new_value
	 * @returns {void}
	 */
	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) {
				// store is ready
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1]);
					}
					subscriber_queue.length = 0;
				}
			}
		}
	}

	/**
	 * @param {import('./public.js').Updater<T>} fn
	 * @returns {void}
	 */
	function update(fn) {
		set(fn(value));
	}

	/**
	 * @param {import('./public.js').Subscriber<T>} run
	 * @param {import('./private.js').Invalidator<T>} [invalidate]
	 * @returns {import('./public.js').Unsubscriber}
	 */
	function subscribe(run, invalidate = noop) {
		/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
		const subscriber = [run, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			stop = start(set, update) || noop;
		}
		run(value);
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return { set, update, subscribe };
}

// The themes supported are 'dark' and 'light'

// Initialize the theme based on user's previous choices stored in localStorage
function getInitialTheme() {
    return localStorage.getItem('vmblu-theme') || 'dark'; // Default to 'light' if nothing in localStorage
}

// the global theme variable
const theme = writable(getInitialTheme());

// save it when it changes
theme.subscribe(value => {
    localStorage.setItem('vmblu-theme', value);  // Update localStorage whenever the theme changes
});

/* fragments\popup-box.svelte generated by Svelte v4.2.20 */

function create_if_block_2$3(ctx) {
	let i;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "description";
			attr(i, "class", "material-icons-outlined open svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, i, anchor);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onOpen*/ ctx[5]),
					listen(i, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(i);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (208:3) {#if box.add}
function create_if_block_1$4(ctx) {
	let i;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "add_circle";
			attr(i, "class", "material-icons-outlined open svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, i, anchor);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onAdd*/ ctx[6]),
					listen(i, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(i);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (217:2) {#if box.trash}
function create_if_block$5(ctx) {
	let div;
	let i;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			i = element("i");
			i.textContent = "delete";
			attr(i, "class", "material-icons-outlined trash svelte-e6df58");
			attr(div, "class", "right-icons svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, i);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onTrash*/ ctx[7]),
					listen(i, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$n(ctx) {
	let div2;
	let div1;
	let div0;
	let i0;
	let t1;
	let i1;
	let t3;
	let t4;
	let t5;
	let h1;
	let t6_value = /*box*/ ctx[0].title + "";
	let t6;
	let t7;
	let t8;
	let div2_class_value;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*box*/ ctx[0].open && create_if_block_2$3(ctx);
	let if_block1 = /*box*/ ctx[0].add && create_if_block_1$4(ctx);
	let if_block2 = /*box*/ ctx[0].trash && create_if_block$5(ctx);
	const default_slot_template = /*#slots*/ ctx[10].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

	return {
		c() {
			div2 = element("div");
			div1 = element("div");
			div0 = element("div");
			i0 = element("i");
			i0.textContent = "cancel";
			t1 = space();
			i1 = element("i");
			i1.textContent = "check_circle";
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			h1 = element("h1");
			t6 = text(t6_value);
			t7 = space();
			if (if_block2) if_block2.c();
			t8 = space();
			if (default_slot) default_slot.c();
			attr(i0, "class", "material-icons-outlined cancel svelte-e6df58");
			attr(i1, "class", "material-icons-outlined check svelte-e6df58");
			attr(div0, "class", "left-icons svelte-e6df58");
			attr(h1, "class", "svelte-e6df58");
			attr(div1, "class", "hdr svelte-e6df58");
			attr(div2, "class", div2_class_value = "main " + /*$theme*/ ctx[1] + " svelte-e6df58");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, div0);
			append(div0, i0);
			append(div0, t1);
			append(div0, i1);
			append(div0, t3);
			if (if_block0) if_block0.m(div0, null);
			append(div0, t4);
			if (if_block1) if_block1.m(div0, null);
			append(div1, t5);
			append(div1, h1);
			append(h1, t6);
			append(div1, t7);
			if (if_block2) if_block2.m(div1, null);
			append(div2, t8);

			if (default_slot) {
				default_slot.m(div2, null);
			}

			/*div2_binding*/ ctx[11](div2);
			current = true;

			if (!mounted) {
				dispose = [
					listen(i0, "click", /*onCancel*/ ctx[3]),
					listen(i0, "keydown", /*onKeydown*/ ctx[8]),
					listen(i1, "click", /*onOk*/ ctx[4]),
					listen(i1, "keydown", /*onKeydown*/ ctx[8]),
					listen(div1, "mousedown", /*onMouseDown*/ ctx[2]),
					listen(div2, "keydown", /*onKeydown*/ ctx[8])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*box*/ ctx[0].open) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_2$3(ctx);
					if_block0.c();
					if_block0.m(div0, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*box*/ ctx[0].add) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_1$4(ctx);
					if_block1.c();
					if_block1.m(div0, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if ((!current || dirty & /*box*/ 1) && t6_value !== (t6_value = /*box*/ ctx[0].title + "")) set_data(t6, t6_value);

			if (/*box*/ ctx[0].trash) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block$5(ctx);
					if_block2.c();
					if_block2.m(div1, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 512)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[9],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null),
						null
					);
				}
			}

			if (!current || dirty & /*$theme*/ 2 && div2_class_value !== (div2_class_value = "main " + /*$theme*/ ctx[1] + " svelte-e6df58")) {
				attr(div2, "class", div2_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div2);
			}

			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (default_slot) default_slot.d(detaching);
			/*div2_binding*/ ctx[11](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$n($$self, $$props, $$invalidate) {
	let $theme;
	component_subscribe($$self, theme, $$value => $$invalidate(1, $theme = $$value));
	let { $$slots: slots = {}, $$scope } = $$props;
	let { box } = $$props;

	// dragging behaviour
	let startX, startY, initialLeft, initialTop;

	let dragging = false;

	onMount(() => {
		// set the show, hide and update functions
		$$invalidate(0, box.show = show, box);

		$$invalidate(0, box.hide = hide, box);
		$$invalidate(0, box.update = () => $$invalidate(0, box), box);
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
			$$invalidate(0, box.div.style.left = `${initialLeft + dx}px`, box);
			$$invalidate(0, box.div.style.top = `${initialTop + dy}px`, box);
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
			$$invalidate(0, box.div.style.left = `${pos.x}px`, box);
			$$invalidate(0, box.div.style.top = `${pos.y}px`, box);
		}

		$$invalidate(0, box.div.style.display = 'block', box);
		$$invalidate(0, box);
	}

	function hide() {
		$$invalidate(0, box.div.style.display = 'none', box);
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
		return e.key == "Enter"
		? onOk(e)
		: e.key == "Escape" || e.key == "Esc" ? onCancel(e) : null;
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			box.div = $$value;
			$$invalidate(0, box);
		});
	}

	$$self.$$set = $$props => {
		if ('box' in $$props) $$invalidate(0, box = $$props.box);
		if ('$$scope' in $$props) $$invalidate(9, $$scope = $$props.$$scope);
	};

	return [
		box,
		$theme,
		onMouseDown,
		onCancel,
		onOk,
		onOpen,
		onAdd,
		onTrash,
		onKeydown,
		$$scope,
		slots,
		div2_binding
	];
}

class Popup_box extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$n, create_fragment$n, safe_not_equal, { box: 0 });
	}
}

/* fragments\same-line.svelte generated by Svelte v4.2.20 */

function create_fragment$m(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	return {
		c() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr(div, "class", "same-line svelte-nv80og");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[0],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
						null
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$m($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class Same_line extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$m, create_fragment$m, safe_not_equal, {});
	}
}

/* fragments\label.svelte generated by Svelte v4.2.20 */

function create_fragment$l(ctx) {
	let label;
	let t;
	let label_style_value;

	return {
		c() {
			label = element("label");
			t = text(/*text*/ ctx[0]);
			attr(label, "class", "label svelte-1w9b525");
			attr(label, "style", label_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '');
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, t);
		},
		p(ctx, [dirty]) {
			if (dirty & /*text*/ 1) set_data(t, /*text*/ ctx[0]);

			if (dirty & /*style*/ 2 && label_style_value !== (label_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '')) {
				attr(label, "style", label_style_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(label);
			}
		}
	};
}

function instance$l($$self, $$props, $$invalidate) {
	let { text } = $$props;
	let { style } = $$props;

	$$self.$$set = $$props => {
		if ('text' in $$props) $$invalidate(0, text = $$props.text);
		if ('style' in $$props) $$invalidate(1, style = $$props.style);
	};

	return [text, style];
}

class Label extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$l, create_fragment$l, safe_not_equal, { text: 0, style: 1 });
	}
}

/* fragments\text-field.svelte generated by Svelte v4.2.20 */

function create_fragment$k(ctx) {
	let input_1;
	let input_1_style_value;
	let mounted;
	let dispose;

	return {
		c() {
			input_1 = element("input");
			attr(input_1, "class", "grow svelte-w2c0k9");
			attr(input_1, "style", input_1_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '');
			attr(input_1, "type", "text");
			attr(input_1, "spellcheck", "false");
		},
		m(target, anchor) {
			insert(target, input_1, anchor);
			set_input_value(input_1, /*text*/ ctx[0]);
			/*input_1_binding*/ ctx[6](input_1);

			if (!mounted) {
				dispose = [
					listen(input_1, "input", /*input_1_input_handler*/ ctx[5]),
					listen(input_1, "input", /*onInput*/ ctx[3])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*style*/ 2 && input_1_style_value !== (input_1_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '')) {
				attr(input_1, "style", input_1_style_value);
			}

			if (dirty & /*text*/ 1 && input_1.value !== /*text*/ ctx[0]) {
				set_input_value(input_1, /*text*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(input_1);
			}

			/*input_1_binding*/ ctx[6](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

const badInputColor$1 = "#ff0000";

function instance$k($$self, $$props, $$invalidate) {
	let { text, check, style } = $$props;
	let input;

	// color to indicate good/bad input
	let savedColor = null;

	onMount(() => {
		// save the good color
		savedColor = input.style.color;
	});

	function onInput(e) {
		// reinitialize the width
		$$invalidate(2, input.style.width = '0px', input);

		// Set input width based on its scrollWidth. Add a small buffer (like 2px) to ensure content does not get clipped
		$$invalidate(
			2,
			input.style.width = input.scrollWidth > 100
			? input.scrollWidth + 2 + 'px'
			: '100px',
			input
		);

		// Do we need to check 
		if (check) {
			// show disapproval when input is nok
			$$invalidate(2, input.style.color = check(input.value) ? savedColor : badInputColor$1, input);
		}
	}

	function input_1_input_handler() {
		text = this.value;
		$$invalidate(0, text);
	}

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			input = $$value;
			$$invalidate(2, input);
		});
	}

	$$self.$$set = $$props => {
		if ('text' in $$props) $$invalidate(0, text = $$props.text);
		if ('check' in $$props) $$invalidate(4, check = $$props.check);
		if ('style' in $$props) $$invalidate(1, style = $$props.style);
	};

	return [text, style, input, onInput, check, input_1_input_handler, input_1_binding];
}

class Text_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$k, create_fragment$k, safe_not_equal, { text: 0, check: 4, style: 1 });
	}
}

/* fragments\checkbox.svelte generated by Svelte v4.2.20 */

function create_fragment$j(ctx) {
	let input;
	let input_style_value;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "style", input_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '');
			attr(input, "type", "checkbox");
			attr(input, "class", "svelte-z24rrd");
		},
		m(target, anchor) {
			insert(target, input, anchor);
			input.checked = /*on*/ ctx[0];

			if (!mounted) {
				dispose = [
					listen(input, "change", /*input_change_handler*/ ctx[4]),
					listen(input, "input", /*onInput*/ ctx[2])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*style*/ 2 && input_style_value !== (input_style_value = /*style*/ ctx[1] ? /*style*/ ctx[1] : '')) {
				attr(input, "style", input_style_value);
			}

			if (dirty & /*on*/ 1) {
				input.checked = /*on*/ ctx[0];
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(input);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$j($$self, $$props, $$invalidate) {
	let { style } = $$props;
	let { on } = $$props;
	let { onToggle } = $$props;

	onMount(() => {
		
	});

	// call the on color function if requested
	function onInput(e) {
		onToggle?.(on);
	}

	function input_change_handler() {
		on = this.checked;
		$$invalidate(0, on);
	}

	$$self.$$set = $$props => {
		if ('style' in $$props) $$invalidate(1, style = $$props.style);
		if ('on' in $$props) $$invalidate(0, on = $$props.on);
		if ('onToggle' in $$props) $$invalidate(3, onToggle = $$props.onToggle);
	};

	return [on, style, onInput, onToggle, input_change_handler];
}

class Checkbox extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$j, create_fragment$j, safe_not_equal, { style: 1, on: 0, onToggle: 3 });
	}
}

/* nodes\runtime-settings\runtime-settings.svelte generated by Svelte v4.2.20 */

function create_default_slot_2(ctx) {
	let checkbox;
	let t;
	let label;
	let current;

	checkbox = new Checkbox({
			props: {
				on: /*localRx*/ ctx[1].logMessages,
				onToggle
			}
		});

	label = new Label({ props: { text: "log messages" } });

	return {
		c() {
			create_component(checkbox.$$.fragment);
			t = space();
			create_component(label.$$.fragment);
		},
		m(target, anchor) {
			mount_component(checkbox, target, anchor);
			insert(target, t, anchor);
			mount_component(label, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const checkbox_changes = {};
			if (dirty & /*localRx*/ 2) checkbox_changes.on = /*localRx*/ ctx[1].logMessages;
			checkbox.$set(checkbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(checkbox.$$.fragment, local);
			transition_in(label.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(checkbox.$$.fragment, local);
			transition_out(label.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(checkbox, detaching);
			destroy_component(label, detaching);
		}
	};
}

// (79:4) <SameLine>
function create_default_slot_1(ctx) {
	let checkbox;
	let t0;
	let label;
	let t1;
	let textfield;
	let current;

	checkbox = new Checkbox({
			props: { field: /*localRx*/ ctx[1].worker.on }
		});

	label = new Label({
			props: {
				text: "use worker script:",
				style: "margin-right: 0.5rem;"
			}
		});

	textfield = new Text_field({
			props: { field: /*localRx*/ ctx[1].worker.path }
		});

	return {
		c() {
			create_component(checkbox.$$.fragment);
			t0 = space();
			create_component(label.$$.fragment);
			t1 = space();
			create_component(textfield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(checkbox, target, anchor);
			insert(target, t0, anchor);
			mount_component(label, target, anchor);
			insert(target, t1, anchor);
			mount_component(textfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const checkbox_changes = {};
			if (dirty & /*localRx*/ 2) checkbox_changes.field = /*localRx*/ ctx[1].worker.on;
			checkbox.$set(checkbox_changes);
			const textfield_changes = {};
			if (dirty & /*localRx*/ 2) textfield_changes.field = /*localRx*/ ctx[1].worker.path;
			textfield.$set(textfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(checkbox.$$.fragment, local);
			transition_in(label.$$.fragment, local);
			transition_in(textfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(checkbox.$$.fragment, local);
			transition_out(label.$$.fragment, local);
			transition_out(textfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}

			destroy_component(checkbox, detaching);
			destroy_component(label, detaching);
			destroy_component(textfield, detaching);
		}
	};
}

// (74:0) <PopupBox box={box}>
function create_default_slot$9(ctx) {
	let sameline0;
	let t;
	let sameline1;
	let current;

	sameline0 = new Same_line({
			props: {
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			}
		});

	sameline1 = new Same_line({
			props: {
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(sameline0.$$.fragment);
			t = space();
			create_component(sameline1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(sameline0, target, anchor);
			insert(target, t, anchor);
			mount_component(sameline1, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const sameline0_changes = {};

			if (dirty & /*$$scope, localRx*/ 18) {
				sameline0_changes.$$scope = { dirty, ctx };
			}

			sameline0.$set(sameline0_changes);
			const sameline1_changes = {};

			if (dirty & /*$$scope, localRx*/ 18) {
				sameline1_changes.$$scope = { dirty, ctx };
			}

			sameline1.$set(sameline1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(sameline0.$$.fragment, local);
			transition_in(sameline1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(sameline0.$$.fragment, local);
			transition_out(sameline1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(sameline0, detaching);
			destroy_component(sameline1, detaching);
		}
	};
}

function create_fragment$i(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$9] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, localRx*/ 18) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function onToggle(e) {
	
}

function instance$i($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	onMount(() => {
		// send out the div
		tx.send("modal div", box.div);
	});

	// the popup box data
	const box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// set the defauult value 
	const localRx = {
		logMessages: false,
		worker: { on: false, path: '' }
	};

	const handlers = {
		// Settings is the link header of the document
		"-> show"({ title, pos, rx, ok, cancel }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			// if there is a callback, call it
			$$invalidate(
				0,
				box.ok = e => {
					if (!ok) return;

					// call ok with the local rx
					ok(localRx);
				},
				box
			);

			$$invalidate(
				0,
				box.cancel = () => {
					cancel?.();
				},
				box
			);

			// Copy the settings if any
			if (rx) {
				$$invalidate(1, localRx.logMessages = rx.logMessages, localRx);
				$$invalidate(1, localRx.worker.on = rx.worker.on, localRx);
				$$invalidate(1, localRx.worker.path = rx.worker.path, localRx);
			}

			// and show
			box.show(box.pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
	};

	return [box, localRx, tx, handlers];
}

class Runtime_settings extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$i, create_fragment$i, safe_not_equal, { tx: 2, handlers: 3 });
	}

	get handlers() {
		return this.$$.ctx[3];
	}
}

/* nodes\confirm-box\confirm-box.svelte generated by Svelte v4.2.20 */

function create_fragment$h(ctx) {
	let popupbox;
	let current;
	popupbox = new Popup_box({ props: { box: /*box*/ ctx[0] } });

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];
			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$h($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	onMount(async () => {
		// send the box div
		tx.send('modal div', box.div);
	});

	// the popup box data
	const box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	const handlers = {
		"-> show"({ title, message, pos, ok, cancel }) {
			// set the box parameters
			$$invalidate(0, box.title = title, box);

			$$invalidate(0, box.ok = ok, box);
			$$invalidate(0, box.cancel = cancel, box);

			// show
			box.show(pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(1, tx = $$props.tx);
	};

	return [box, tx, handlers];
}

class Confirm_box extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$h, create_fragment$h, safe_not_equal, { tx: 1, handlers: 2 });
	}

	get handlers() {
		return this.$$.ctx[2];
	}
}

/* nodes\context-menu\context-menu.svelte generated by Svelte v4.2.20 */

function get_each_context$4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i];
	child_ctx[11] = i;
	return child_ctx;
}

// (177:2) {#each context.menu as choice, index}
function create_each_block$4(ctx) {
	let li;
	let i;
	let t0_value = /*choice*/ ctx[9].icon + "";
	let t0;
	let i_class_value;
	let t1;
	let span0;
	let t2_value = /*choice*/ ctx[9].text + "";
	let t2;
	let t3;
	let span1;
	let t4_value = (/*choice*/ ctx[9].char ?? ' ') + "";
	let t4;
	let t5;
	let li_class_value;
	let mounted;
	let dispose;

	return {
		c() {
			li = element("li");
			i = element("i");
			t0 = text(t0_value);
			t1 = space();
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			span1 = element("span");
			t4 = text(t4_value);
			t5 = space();
			attr(i, "class", i_class_value = "material-icons-outlined choice-icon " + /*choice*/ ctx[9].state + " svelte-1wos05d");
			attr(span0, "class", "choice-text svelte-1wos05d");
			attr(span1, "class", "choice-char svelte-1wos05d");
			attr(li, "data-index", /*index*/ ctx[11]);
			attr(li, "class", li_class_value = "" + (null_to_empty(/*choice*/ ctx[9].state) + " svelte-1wos05d"));
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, i);
			append(i, t0);
			append(li, t1);
			append(li, span0);
			append(span0, t2);
			append(li, t3);
			append(li, span1);
			append(span1, t4);
			append(li, t5);

			if (!mounted) {
				dispose = [
					listen(li, "click", /*onClickLI*/ ctx[3]),
					listen(li, "keydown", onKeydown$4)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*context*/ 1 && t0_value !== (t0_value = /*choice*/ ctx[9].icon + "")) set_data(t0, t0_value);

			if (dirty & /*context*/ 1 && i_class_value !== (i_class_value = "material-icons-outlined choice-icon " + /*choice*/ ctx[9].state + " svelte-1wos05d")) {
				attr(i, "class", i_class_value);
			}

			if (dirty & /*context*/ 1 && t2_value !== (t2_value = /*choice*/ ctx[9].text + "")) set_data(t2, t2_value);
			if (dirty & /*context*/ 1 && t4_value !== (t4_value = (/*choice*/ ctx[9].char ?? ' ') + "")) set_data(t4, t4_value);

			if (dirty & /*context*/ 1 && li_class_value !== (li_class_value = "" + (null_to_empty(/*choice*/ ctx[9].state) + " svelte-1wos05d"))) {
				attr(li, "class", li_class_value);
			}
		},
		d(detaching) {
			if (detaching) {
				detach(li);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$g(ctx) {
	let div;
	let ul;
	let mounted;
	let dispose;
	let each_value = ensure_array_like(/*context*/ ctx[0].menu);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(ul, "class", "svelte-1wos05d");
			attr(div, "class", "svelte-1wos05d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			/*div_binding*/ ctx[6](div);

			if (!mounted) {
				dispose = [
					listen(ul, "mouseleave", /*hide*/ ctx[1]),
					listen(div, "click", /*hide*/ ctx[1]),
					listen(div, "contextmenu", /*goAway*/ ctx[2]),
					listen(div, "keydown", onKeydown$4)
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*context, onClickLI, onKeydown*/ 9) {
				each_value = ensure_array_like(/*context*/ ctx[0].menu);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$4(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$4(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
			/*div_binding*/ ctx[6](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function onKeydown$4(e) {
	
}

function instance$g($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	let context = {
		div: null,
		menu: [],
		show: () => {
			
		}
	};

	onMount(() => {
		$$invalidate(0, context.show = show, context);

		// send the box div
		tx.send('modal div', context.div);
	});

	const handlers = {
		// pos = x,y = e.clientX e.clientY
		"-> context menu"({ menu, event }) {
			// set the menu
			$$invalidate(0, context.menu = menu, context);

			// show the menu at the requested position
			context.show(event);
		}
	};

	// show the list - typically on a right click "oncontextmenu"
	function show(e) {
		// check
		if (context.menu.length <= 0) return;

		// calculate the width of the list
		setWidth();

		// the div has the display 'absolute' attribute - so we use client coordinates !
		$$invalidate(0, context.div.style.display = "block", context);

		// + or -10 is to make sure the cursor is in the selection list
		$$invalidate(0, context.div.style.left = `${e.clientX - 10}px`, context);

		$$invalidate(0, context.div.style.top = `${e.clientY - 20}px`, context);

		// force an update
		$$invalidate(0, context);
	}

	// calculate the width of the list
	function setWidth() {
		// determine the width of the clicklist
		let max = 0;

		context.menu.forEach(choice => {
			const len = choice.text.length + (choice.char ? choice.char.length + 5 : 0);
			if (len > max) max = len;
		});

		// set the width of the UL
		context.div.querySelector("ul").style.width = (0.5 * max + 1.5).toString() + "rem";
	}

	// when getting out of the ul area
	function hide(e) {
		$$invalidate(0, context.div.style.display = "none", context);
	}

	function goAway(e) {
		e.preventDefault();
		$$invalidate(0, context.div.style.display = "none", context);
	}

	// when selecting in the ul
	function onClickLI(e) {
		// hide the list
		$$invalidate(0, context.div.style.display = "none", context);

		// get the index
		let index = e.target.dataset.index ?? e.target.parentNode.dataset.index;

		// check if enabled
		if (context.menu[index]) {
			if (context.menu[index].state == "enabled") context.menu[index].action(e);
		}
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			context.div = $$value;
			$$invalidate(0, context);
		});
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(4, tx = $$props.tx);
	};

	return [context, hide, goAway, onClickLI, tx, handlers, div_binding];
}

class Context_menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$g, create_fragment$g, safe_not_equal, { tx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

/* fragments\text-area-input.svelte generated by Svelte v4.2.20 */

function create_fragment$f(ctx) {
	let textarea;
	let mounted;
	let dispose;

	return {
		c() {
			textarea = element("textarea");
			attr(textarea, "name", "txt-name");
			attr(textarea, "spellcheck", "false");
			attr(textarea, "rows", /*rows*/ ctx[2]);
			attr(textarea, "cols", /*cols*/ ctx[1]);
			attr(textarea, "class", "svelte-1xkqtu5");
		},
		m(target, anchor) {
			insert(target, textarea, anchor);
			set_input_value(textarea, /*text*/ ctx[0]);

			if (!mounted) {
				dispose = [
					listen(textarea, "input", /*textarea_input_handler*/ ctx[3]),
					listen(textarea, "keydown", onKeydown$3)
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*rows*/ 4) {
				attr(textarea, "rows", /*rows*/ ctx[2]);
			}

			if (dirty & /*cols*/ 2) {
				attr(textarea, "cols", /*cols*/ ctx[1]);
			}

			if (dirty & /*text*/ 1) {
				set_input_value(textarea, /*text*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(textarea);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function onKeydown$3(e) {
	if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
}

function instance$f($$self, $$props, $$invalidate) {
	let { text, cols, rows } = $$props;

	onMount(() => {
		
	});

	function textarea_input_handler() {
		text = this.value;
		$$invalidate(0, text);
	}

	$$self.$$set = $$props => {
		if ('text' in $$props) $$invalidate(0, text = $$props.text);
		if ('cols' in $$props) $$invalidate(1, cols = $$props.cols);
		if ('rows' in $$props) $$invalidate(2, rows = $$props.rows);
	};

	return [text, cols, rows, textarea_input_handler];
}

let Text_area_input$1 = class Text_area_input extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$f, create_fragment$f, safe_not_equal, { text: 0, cols: 1, rows: 2 });
	}
};

/* nodes\json-area-input\json-area-input.svelte generated by Svelte v4.2.20 */

function create_default_slot$8(ctx) {
	let textareainput;
	let updating_text;
	let current;

	function textareainput_text_binding(value) {
		/*textareainput_text_binding*/ ctx[4](value);
	}

	let textareainput_props = { cols: "50", rows: "25" };

	if (/*text*/ ctx[1] !== void 0) {
		textareainput_props.text = /*text*/ ctx[1];
	}

	textareainput = new Text_area_input$1({ props: textareainput_props });
	binding_callbacks.push(() => bind(textareainput, 'text', textareainput_text_binding));

	return {
		c() {
			create_component(textareainput.$$.fragment);
		},
		m(target, anchor) {
			mount_component(textareainput, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const textareainput_changes = {};

			if (!updating_text && dirty & /*text*/ 2) {
				updating_text = true;
				textareainput_changes.text = /*text*/ ctx[1];
				add_flush_callback(() => updating_text = false);
			}

			textareainput.$set(textareainput_changes);
		},
		i(local) {
			if (current) return;
			transition_in(textareainput.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(textareainput.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(textareainput, detaching);
		}
	};
}

function create_fragment$e(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$8] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, text*/ 66) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$e($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	onMount(async () => {
		tx.send("modal div", box.div);
	});

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// the text
	let text = '';

	const handlers = {
		"-> json"({ title, pos, json, ok }) {
			// set the box parameters
			$$invalidate(0, box.title = title, box);

			$$invalidate(0, box.pos = { ...pos }, box);

			// The ok function for the box
			$$invalidate(
				0,
				box.ok = () => {
					// check
					const newJson = checkJSON();

					// check for empty 
					if (newJson?.length == 0) return ok ? ok('') : null;

					// save or restart
					newJson ? ok?.(newJson) : box.show(pos);
				},
				box
			);

			// transform json to text
			$$invalidate(1, text = json ? JSON.stringify(json, null, '  ') : '');

			box.show(pos);
		}
	};

	function checkJSON() {
		// check for a SyntaxError
		let syntax = text.indexOf("SyntaxError");

		// remove the syntax error if any
		if (syntax != -1) $$invalidate(1, text = syntax > 1 ? text.slice(0, syntax - 2) : '');

		// it could be that the content is just empty
		if (text.length == 0) return '';

		// convert the json to an object
		try {
			// parse the content of the field
			return JSON.parse(text);
		} catch(error) {
			// show the content followed by the error
			$$invalidate(1, text = text + '\n\n' + error);

			// no valid json
			return null;
		}
	}

	function textareainput_text_binding(value) {
		text = value;
		$$invalidate(1, text);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
	};

	return [box, text, tx, handlers, textareainput_text_binding];
}

class Json_area_input extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$e, create_fragment$e, safe_not_equal, { tx: 2, handlers: 3 });
	}

	get handlers() {
		return this.$$.ctx[3];
	}
}

/* nodes\text-area-input\text-area-input.svelte generated by Svelte v4.2.20 */

function create_default_slot$7(ctx) {
	let textareainput;
	let updating_text;
	let current;

	function textareainput_text_binding(value) {
		/*textareainput_text_binding*/ ctx[4](value);
	}

	let textareainput_props = { cols: "50", rows: "25" };

	if (/*newText*/ ctx[1] !== void 0) {
		textareainput_props.text = /*newText*/ ctx[1];
	}

	textareainput = new Text_area_input$1({ props: textareainput_props });
	binding_callbacks.push(() => bind(textareainput, 'text', textareainput_text_binding));

	return {
		c() {
			create_component(textareainput.$$.fragment);
		},
		m(target, anchor) {
			mount_component(textareainput, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const textareainput_changes = {};

			if (!updating_text && dirty & /*newText*/ 2) {
				updating_text = true;
				textareainput_changes.text = /*newText*/ ctx[1];
				add_flush_callback(() => updating_text = false);
			}

			textareainput.$set(textareainput_changes);
		},
		i(local) {
			if (current) return;
			transition_in(textareainput.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(textareainput.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(textareainput, detaching);
		}
	};
}

function create_fragment$d(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$7] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, newText*/ 34) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$d($$self, $$props, $$invalidate) {
	let { tx } = $$props; // sx

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	onMount(() => {
		tx.send("modal div", box.div);
	});

	// the text
	let newText = '';

	const handlers = {
		"-> text"({ header, pos, text, ok = null, cancel = null }) {
			// set the box parameters
			$$invalidate(0, box.title = header, box);

			$$invalidate(
				0,
				box.ok = () => {
					ok?.(newText);
				},
				box
			);

			// set the text field
			$$invalidate(1, newText = text);

			// show
			box.show(pos);
		}
	};

	function textareainput_text_binding(value) {
		newText = value;
		$$invalidate(1, newText);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
	};

	return [box, newText, tx, handlers, textareainput_text_binding];
}

class Text_area_input extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$d, create_fragment$d, safe_not_equal, { tx: 2, handlers: 3 });
	}

	get handlers() {
		return this.$$.ctx[3];
	}
}

/* fragments\profile-input-pin.svelte generated by Svelte v4.2.20 */

function get_each_context$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[3] = list[i];
	return child_ctx;
}

function get_each_context_1$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i].type;
	child_ctx[7] = list[i].name;
	child_ctx[8] = list[i].description;
	return child_ctx;
}

// (110:2) {#if profile != null}
function create_if_block$4(ctx) {
	let div0;
	let p;
	let span;
	let t0_value = /*profile*/ ctx[0].handler + "";
	let t0;
	let t1;
	let t2_value = ' ' + "";
	let t2;
	let t3;
	let t4_value = /*profile*/ ctx[0].file + "";
	let t4;
	let t5;
	let t6_value = /*profile*/ ctx[0].line + "";
	let t6;
	let t7;
	let t8;
	let div1;
	let t9;
	let div2;
	let t10;
	let div3;
	let pre;
	let t11_value = /*profile*/ ctx[0].summary + "";
	let t11;
	let mounted;
	let dispose;
	let each_value_1 = ensure_array_like(/*profile*/ ctx[0].params);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1$3(get_each_context_1$3(ctx, each_value_1, i));
	}

	function select_block_type(ctx, dirty) {
		if (/*profile*/ ctx[0].typeErrors?.length) return create_if_block_1$3;
		return create_else_block$2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			div0 = element("div");
			p = element("p");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			t2 = text(t2_value);
			t3 = text("in ");
			t4 = text(t4_value);
			t5 = text(" (");
			t6 = text(t6_value);
			t7 = text(")");
			t8 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t9 = space();
			div2 = element("div");
			if_block.c();
			t10 = space();
			div3 = element("div");
			pre = element("pre");
			t11 = text(t11_value);
			attr(span, "class", "clickable svelte-52mbok");
			attr(p, "class", "svelte-52mbok");
			attr(div0, "class", "handler svelte-52mbok");
			attr(div1, "class", "params svelte-52mbok");
			attr(div2, "class", "type-status svelte-52mbok");
			attr(pre, "class", "svelte-52mbok");
			attr(div3, "class", "prompt svelte-52mbok");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, p);
			append(p, span);
			append(span, t0);
			append(p, t1);
			append(p, t2);
			append(p, t3);
			append(p, t4);
			append(p, t5);
			append(p, t6);
			append(p, t7);
			insert(target, t8, anchor);
			insert(target, div1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div1, null);
				}
			}

			insert(target, t9, anchor);
			insert(target, div2, anchor);
			if_block.m(div2, null);
			insert(target, t10, anchor);
			insert(target, div3, anchor);
			append(div3, pre);
			append(pre, t11);

			if (!mounted) {
				dispose = [
					listen(span, "click", /*click_handler*/ ctx[2]),
					listen(span, "keydown", onKeydown$2)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t0_value !== (t0_value = /*profile*/ ctx[0].handler + "")) set_data(t0, t0_value);
			if (dirty & /*profile*/ 1 && t4_value !== (t4_value = /*profile*/ ctx[0].file + "")) set_data(t4, t4_value);
			if (dirty & /*profile*/ 1 && t6_value !== (t6_value = /*profile*/ ctx[0].line + "")) set_data(t6, t6_value);

			if (dirty & /*profile*/ 1) {
				each_value_1 = ensure_array_like(/*profile*/ ctx[0].params);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1$3(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1$3(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div2, null);
				}
			}

			if (dirty & /*profile*/ 1 && t11_value !== (t11_value = /*profile*/ ctx[0].summary + "")) set_data(t11, t11_value);
		},
		d(detaching) {
			if (detaching) {
				detach(div0);
				detach(t8);
				detach(div1);
				detach(t9);
				detach(div2);
				detach(t10);
				detach(div3);
			}

			destroy_each(each_blocks, detaching);
			if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (121:6) {#each profile.params as { type, name, description }}
function create_each_block_1$3(ctx) {
	let p;
	let t0_value = /*name*/ ctx[7] + "";
	let t0;
	let t1;
	let t2_value = /*type*/ ctx[6] + "";
	let t2;
	let t3;
	let t4_value = /*description*/ ctx[8] + "";
	let t4;

	return {
		c() {
			p = element("p");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(") ");
			t4 = text(t4_value);
			attr(p, "class", "svelte-52mbok");
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t0);
			append(p, t1);
			append(p, t2);
			append(p, t3);
			append(p, t4);
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t0_value !== (t0_value = /*name*/ ctx[7] + "")) set_data(t0, t0_value);
			if (dirty & /*profile*/ 1 && t2_value !== (t2_value = /*type*/ ctx[6] + "")) set_data(t2, t2_value);
			if (dirty & /*profile*/ 1 && t4_value !== (t4_value = /*description*/ ctx[8] + "")) set_data(t4, t4_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}
		}
	};
}

// (131:6) {:else}
function create_else_block$2(ctx) {
	let p;

	return {
		c() {
			p = element("p");
			p.textContent = "contract match";
			attr(p, "class", "type-ok svelte-52mbok");
		},
		m(target, anchor) {
			insert(target, p, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(p);
			}
		}
	};
}

// (127:6) {#if profile.typeErrors?.length}
function create_if_block_1$3(ctx) {
	let each_1_anchor;
	let each_value = ensure_array_like(/*profile*/ ctx[0].typeErrors);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1) {
				each_value = ensure_array_like(/*profile*/ ctx[0].typeErrors);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$3(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$3(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (128:8) {#each profile.typeErrors as msg}
function create_each_block$3(ctx) {
	let p;
	let t_value = /*msg*/ ctx[3] + "";
	let t;

	return {
		c() {
			p = element("p");
			t = text(t_value);
			attr(p, "class", "type-warning svelte-52mbok");
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t_value !== (t_value = /*msg*/ ctx[3] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}
		}
	};
}

function create_fragment$c(ctx) {
	let div;
	let if_block = /*profile*/ ctx[0] != null && create_if_block$4(ctx);

	return {
		c() {
			div = element("div");
			if (if_block) if_block.c();
			attr(div, "class", "profile svelte-52mbok");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
		},
		p(ctx, [dirty]) {
			if (/*profile*/ ctx[0] != null) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$4(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (if_block) if_block.d();
		}
	};
}

function onKeydown$2(e) {
	if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
}

function instance$c($$self, $$props, $$invalidate) {
	let { profile, open } = $$props;
	const click_handler = () => open?.({ file: profile.file, line: profile.line });

	$$self.$$set = $$props => {
		if ('profile' in $$props) $$invalidate(0, profile = $$props.profile);
		if ('open' in $$props) $$invalidate(1, open = $$props.open);
	};

	return [profile, open, click_handler];
}

class Profile_input_pin extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$c, create_fragment$c, safe_not_equal, { profile: 0, open: 1 });
	}
}

/* fragments\profile-output-pin.svelte generated by Svelte v4.2.20 */

function create_if_block$3(ctx) {
	let div;
	let p;
	let span;
	let t0_value = /*profile*/ ctx[0].pin + "";
	let t0;
	let t1;
	let t2_value = /*profile*/ ctx[0].file + "";
	let t2;
	let t3;
	let t4_value = /*profile*/ ctx[0].line + "";
	let t4;
	let t5;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			p = element("p");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			t2 = text(t2_value);
			t3 = text(" (");
			t4 = text(t4_value);
			t5 = text(")");
			attr(span, "class", "clickable svelte-1s2gtx8");
			attr(p, "class", "svelte-1s2gtx8");
			attr(div, "class", "transmit svelte-1s2gtx8");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, p);
			append(p, span);
			append(span, t0);
			append(p, t1);
			append(p, t2);
			append(p, t3);
			append(p, t4);
			append(p, t5);

			if (!mounted) {
				dispose = [
					listen(span, "click", /*click_handler*/ ctx[2]),
					listen(span, "keydown", onKeydown$1)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*profile*/ 1 && t0_value !== (t0_value = /*profile*/ ctx[0].pin + "")) set_data(t0, t0_value);
			if (dirty & /*profile*/ 1 && t2_value !== (t2_value = /*profile*/ ctx[0].file + "")) set_data(t2, t2_value);
			if (dirty & /*profile*/ 1 && t4_value !== (t4_value = /*profile*/ ctx[0].line + "")) set_data(t4, t4_value);
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$b(ctx) {
	let div;
	let if_block = /*profile*/ ctx[0] != null && create_if_block$3(ctx);

	return {
		c() {
			div = element("div");
			if (if_block) if_block.c();
			attr(div, "class", "profile svelte-1s2gtx8");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
		},
		p(ctx, [dirty]) {
			if (/*profile*/ ctx[0] != null) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$3(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (if_block) if_block.d();
		}
	};
}

function onKeydown$1(e) {
	if (e.key != "Escape" && e.key != "Esc") e.stopPropagation();
}

function instance$b($$self, $$props, $$invalidate) {
	let { profile, open } = $$props;
	const click_handler = () => open?.({ file: profile.file, line: profile.line });

	$$self.$$set = $$props => {
		if ('profile' in $$props) $$invalidate(0, profile = $$props.profile);
		if ('open' in $$props) $$invalidate(1, open = $$props.open);
	};

	return [profile, open, click_handler];
}

class Profile_output_pin extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$b, create_fragment$b, safe_not_equal, { profile: 0, open: 1 });
	}
}

/* fragments\pin-contract.svelte generated by Svelte v4.2.20 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

function get_each_context_1$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[4] = list[i];
	return child_ctx;
}

// (61:0) {#if contract}
function create_if_block$2(ctx) {
	let div1;
	let div0;
	let p;
	let t0;
	let t1_value = (/*contract*/ ctx[0].role ?? 'follower') + "";
	let t1;
	let t2;
	let t3;

	function select_block_type(ctx, dirty) {
		if (/*contract*/ ctx[0].tokens) return create_if_block_1$2;
		if (/*contract*/ ctx[0].text) return create_if_block_2$2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			p = element("p");
			t0 = text("Contract (");
			t1 = text(t1_value);
			t2 = text(")");
			t3 = space();
			if (if_block) if_block.c();
			attr(p, "class", "svelte-1w43hf3");
			attr(div0, "class", "role svelte-1w43hf3");
			attr(div1, "class", "contract svelte-1w43hf3");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);
			append(div0, p);
			append(p, t0);
			append(p, t1);
			append(p, t2);
			append(div1, t3);
			if (if_block) if_block.m(div1, null);
		},
		p(ctx, dirty) {
			if (dirty & /*contract*/ 1 && t1_value !== (t1_value = (/*contract*/ ctx[0].role ?? 'follower') + "")) set_data(t1, t1_value);

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div1, null);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			if (if_block) {
				if_block.d();
			}
		}
	};
}

// (74:28) 
function create_if_block_2$2(ctx) {
	let pre;
	let t_value = /*contract*/ ctx[0].text + "";
	let t;

	return {
		c() {
			pre = element("pre");
			t = text(t_value);
			attr(pre, "class", "text svelte-1w43hf3");
		},
		m(target, anchor) {
			insert(target, pre, anchor);
			append(pre, t);
		},
		p(ctx, dirty) {
			if (dirty & /*contract*/ 1 && t_value !== (t_value = /*contract*/ ctx[0].text + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(pre);
			}
		}
	};
}

// (66:4) {#if contract.tokens}
function create_if_block_1$2(ctx) {
	let each_1_anchor;
	let each_value = ensure_array_like(/*contract*/ ctx[0].tokens);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*contract*/ 1) {
				each_value = ensure_array_like(/*contract*/ ctx[0].tokens);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (69:10) {#each line.parts as part}
function create_each_block_1$2(ctx) {
	let span;
	let t_value = /*part*/ ctx[4].text + "";
	let t;
	let span_class_value;

	return {
		c() {
			span = element("span");
			t = text(t_value);
			attr(span, "class", span_class_value = "part " + /*part*/ ctx[4].kind + " svelte-1w43hf3");
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*contract*/ 1 && t_value !== (t_value = /*part*/ ctx[4].text + "")) set_data(t, t_value);

			if (dirty & /*contract*/ 1 && span_class_value !== (span_class_value = "part " + /*part*/ ctx[4].kind + " svelte-1w43hf3")) {
				attr(span, "class", span_class_value);
			}
		},
		d(detaching) {
			if (detaching) {
				detach(span);
			}
		}
	};
}

// (67:6) {#each contract.tokens as line}
function create_each_block$2(ctx) {
	let div;
	let t;
	let div_class_value;
	let div_style_value;
	let each_value_1 = ensure_array_like(/*line*/ ctx[1].parts);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();

			attr(div, "class", div_class_value = "line " + (/*line*/ ctx[1].parts?.[0]?.kind === 'header'
			? 'header'
			: '') + " svelte-1w43hf3");

			attr(div, "style", div_style_value = `--indent:${/*line*/ ctx[1].indent}`);
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty & /*contract*/ 1) {
				each_value_1 = ensure_array_like(/*line*/ ctx[1].parts);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1$2(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1$2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, t);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (dirty & /*contract*/ 1 && div_class_value !== (div_class_value = "line " + (/*line*/ ctx[1].parts?.[0]?.kind === 'header'
			? 'header'
			: '') + " svelte-1w43hf3")) {
				attr(div, "class", div_class_value);
			}

			if (dirty & /*contract*/ 1 && div_style_value !== (div_style_value = `--indent:${/*line*/ ctx[1].indent}`)) {
				attr(div, "style", div_style_value);
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

function create_fragment$a(ctx) {
	let if_block_anchor;
	let if_block = /*contract*/ ctx[0] && create_if_block$2(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, [dirty]) {
			if (/*contract*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$2(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) if_block.d(detaching);
		}
	};
}

function instance$a($$self, $$props, $$invalidate) {
	let { contract = null } = $$props;

	$$self.$$set = $$props => {
		if ('contract' in $$props) $$invalidate(0, contract = $$props.contract);
	};

	return [contract];
}

class Pin_contract extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$a, create_fragment$a, safe_not_equal, { contract: 0 });
	}
}

/* nodes\pin-profile\pin-profile.svelte generated by Svelte v4.2.20 */

function get_each_context_1$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	return child_ctx;
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	return child_ctx;
}

// (83:0) {:else}
function create_else_block_1$1(ctx) {
	let div;
	let t1;
	let show_if;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_2$1, create_else_block_2];
	const if_blocks = [];

	function select_block_type_2(ctx, dirty) {
		if (dirty & /*_profile*/ 2) show_if = null;
		if (show_if == null) show_if = !!Array.isArray(/*_profile*/ ctx[1]);
		if (show_if) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_2(ctx, -1);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			div = element("div");
			div.innerHTML = `<p class="svelte-1vbnmmk">Send locactions</p>`;
			t1 = space();
			if_block.c();
			if_block_anchor = empty();
			attr(div, "class", "pin svelte-1vbnmmk");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			insert(target, t1, anchor);
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_2(ctx, dirty);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
				detach(if_block_anchor);
			}

			if_blocks[current_block_type_index].d(detaching);
		}
	};
}

// (69:0) {#if _pin?.is.input}
function create_if_block$1(ctx) {
	let show_if;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_1$1, create_else_block$1];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (dirty & /*_profile*/ 2) show_if = null;
		if (show_if == null) show_if = !!Array.isArray(/*_profile*/ ctx[1]);
		if (show_if) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_1(ctx, -1);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx, dirty);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_blocks[current_block_type_index].d(detaching);
		}
	};
}

// (91:4) {:else}
function create_else_block_2(ctx) {
	let outputprofile;
	let current;

	outputprofile = new Profile_output_pin({
			props: {
				profile: /*_profile*/ ctx[1],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			create_component(outputprofile.$$.fragment);
		},
		m(target, anchor) {
			mount_component(outputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const outputprofile_changes = {};
			if (dirty & /*_profile*/ 2) outputprofile_changes.profile = /*_profile*/ ctx[1];
			if (dirty & /*_open*/ 8) outputprofile_changes.open = /*_open*/ ctx[3];
			outputprofile.$set(outputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(outputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(outputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(outputprofile, detaching);
		}
	};
}

// (87:4) {#if Array.isArray(_profile)}
function create_if_block_2$1(ctx) {
	let each_1_anchor;
	let current;
	let each_value_1 = ensure_array_like(/*_profile*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*_profile, _open*/ 10) {
				each_value_1 = ensure_array_like(/*_profile*/ ctx[1]);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_1$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (88:8) {#each _profile as singleProfile}
function create_each_block_1$1(ctx) {
	let outputprofile;
	let current;

	outputprofile = new Profile_output_pin({
			props: {
				profile: /*singleProfile*/ ctx[7],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			create_component(outputprofile.$$.fragment);
		},
		m(target, anchor) {
			mount_component(outputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const outputprofile_changes = {};
			if (dirty & /*_profile*/ 2) outputprofile_changes.profile = /*singleProfile*/ ctx[7];
			if (dirty & /*_open*/ 8) outputprofile_changes.open = /*_open*/ ctx[3];
			outputprofile.$set(outputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(outputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(outputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(outputprofile, detaching);
		}
	};
}

// (77:4) {:else}
function create_else_block$1(ctx) {
	let div;
	let t1;
	let inputprofile;
	let current;

	inputprofile = new Profile_input_pin({
			props: {
				profile: /*_profile*/ ctx[1],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			div = element("div");
			div.innerHTML = `<p class="svelte-1vbnmmk">Handler and parameters</p>`;
			t1 = space();
			create_component(inputprofile.$$.fragment);
			attr(div, "class", "pin svelte-1vbnmmk");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			insert(target, t1, anchor);
			mount_component(inputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const inputprofile_changes = {};
			if (dirty & /*_profile*/ 2) inputprofile_changes.profile = /*_profile*/ ctx[1];
			if (dirty & /*_open*/ 8) inputprofile_changes.open = /*_open*/ ctx[3];
			inputprofile.$set(inputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(inputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(inputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
			}

			destroy_component(inputprofile, detaching);
		}
	};
}

// (70:4) {#if Array.isArray(_profile)}
function create_if_block_1$1(ctx) {
	let div;
	let t1;
	let each_1_anchor;
	let current;
	let each_value = ensure_array_like(/*_profile*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div = element("div");
			div.innerHTML = `<p class="svelte-1vbnmmk">Handlers and parameters</p>`;
			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
			attr(div, "class", "pin svelte-1vbnmmk");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			insert(target, t1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*_profile, _open*/ 10) {
				each_value = ensure_array_like(/*_profile*/ ctx[1]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (74:8) {#each _profile as singleProfile}
function create_each_block$1(ctx) {
	let inputprofile;
	let current;

	inputprofile = new Profile_input_pin({
			props: {
				profile: /*singleProfile*/ ctx[7],
				open: /*_open*/ ctx[3]
			}
		});

	return {
		c() {
			create_component(inputprofile.$$.fragment);
		},
		m(target, anchor) {
			mount_component(inputprofile, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const inputprofile_changes = {};
			if (dirty & /*_profile*/ 2) inputprofile_changes.profile = /*singleProfile*/ ctx[7];
			if (dirty & /*_open*/ 8) inputprofile_changes.open = /*_open*/ ctx[3];
			inputprofile.$set(inputprofile_changes);
		},
		i(local) {
			if (current) return;
			transition_in(inputprofile.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(inputprofile.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(inputprofile, detaching);
		}
	};
}

// (65:0) <PopupBox box={box}>
function create_default_slot$6(ctx) {
	let pincontract;
	let t;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;

	pincontract = new Pin_contract({
			props: { contract: /*_contract*/ ctx[4] }
		});

	const if_block_creators = [create_if_block$1, create_else_block_1$1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*_pin*/ ctx[2]?.is.input) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			create_component(pincontract.$$.fragment);
			t = space();
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			mount_component(pincontract, target, anchor);
			insert(target, t, anchor);
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const pincontract_changes = {};
			if (dirty & /*_contract*/ 16) pincontract_changes.contract = /*_contract*/ ctx[4];
			pincontract.$set(pincontract_changes);
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(pincontract.$$.fragment, local);
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(pincontract.$$.fragment, local);
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
				detach(if_block_anchor);
			}

			destroy_component(pincontract, detaching);
			if_blocks[current_block_type_index].d(detaching);
		}
	};
}

function create_fragment$9(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$6] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _profile, _open, _pin, _contract*/ 4126) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$9($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx;

	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	onMount(() => {
		tx.send("modal div", box.div);
	});

	// save local data
	let _profile = null;

	let _pin = null;
	let _open = null;
	let _contract = null;

	const handlers = {
		onShow({ pos, pin, contract, profile, open = null }) {
			// check and just hide if repeat
			if (_pin && pin === _pin) {
				$$invalidate(2, _pin = null);
				box.hide();
				return;
			}

			$$invalidate(0, box.title = pin.name + ' @ ' + pin.node.name + (pin.is.input ? ' (in)' : ' (out)'), box);

			// box.title = pin.is.left ? ((pin.is.input ? ' \u25B6 ' : ' \u25C0 ' ) + pin.name) : (pin.name + (pin.is.input ? ' \u25C0 ' : ' \u25B6 '));
			$$invalidate(2, _pin = pin);

			$$invalidate(4, _contract = contract);
			$$invalidate(1, _profile = profile);
			$$invalidate(3, _open = open);
			box.show(pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(5, tx = $$props.tx);
	};

	return [box, _profile, _pin, _open, _contract, tx, handlers];
}

class Pin_profile extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$9, safe_not_equal, { tx: 5, handlers: 6 });
	}

	get handlers() {
		return this.$$.ctx[6];
	}
}

/* nodes\message-box\message-box.svelte generated by Svelte v4.2.20 */

function create_default_slot$5(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*text*/ ctx[0]);
			attr(p, "class", "svelte-nkfvqo");
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*text*/ 1) set_data(t, /*text*/ ctx[0]);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}
		}
	};
}

function create_fragment$8(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[1],
				$$slots: { default: [create_default_slot$5] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};

			if (dirty & /*$$scope, text*/ 17) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$8($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	let text = '';

	onMount(async () => {
		tx.send("modal div", box.div);
	});

	const handlers = {
		"-> show"({ title, message, pos, ok, cancel }) {
			// notation
			const box = this.popup.box;

			// set the box parameters
			box.title = title;

			// The message to show
			$$invalidate(0, text = message);

			// show
			box.show(pos);
		}
	};

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
	};

	return [text, box, tx, handlers];
}

class Message_box extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { tx: 2, handlers: 3 });
	}

	get handlers() {
		return this.$$.ctx[3];
	}
}

/* fragments\label-input-field.svelte generated by Svelte v4.2.20 */

function create_fragment$7(ctx) {
	let div;
	let label_1;
	let t0;
	let t1;
	let input_1;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			label_1 = element("label");
			t0 = text(/*label*/ ctx[1]);
			t1 = space();
			input_1 = element("input");
			attr(label_1, "for", /*fid*/ ctx[4]);
			attr(label_1, "style", /*style*/ ctx[2]);
			attr(label_1, "class", "svelte-dgsivs");
			attr(input_1, "id", /*fid*/ ctx[4]);
			attr(input_1, "type", "text");
			attr(input_1, "spellcheck", "false");
			attr(input_1, "class", "svelte-dgsivs");
			attr(div, "class", "input-field svelte-dgsivs");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label_1);
			append(label_1, t0);
			append(div, t1);
			append(div, input_1);
			set_input_value(input_1, /*input*/ ctx[0]);
			/*input_1_binding*/ ctx[8](input_1);

			if (!mounted) {
				dispose = [
					listen(input_1, "input", /*input_1_input_handler*/ ctx[7]),
					listen(input_1, "input", /*onInput*/ ctx[5]),
					listen(input_1, "click", /*onInput*/ ctx[5])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 2) set_data(t0, /*label*/ ctx[1]);

			if (dirty & /*style*/ 4) {
				attr(label_1, "style", /*style*/ ctx[2]);
			}

			if (dirty & /*input*/ 1 && input_1.value !== /*input*/ ctx[0]) {
				set_input_value(input_1, /*input*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			/*input_1_binding*/ ctx[8](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

const badInputColor = "#ff0000";

function instance$7($$self, $$props, $$invalidate) {
	let { label, input, style, check } = $$props;
	let field;
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	const setFieldWidth = () => {
		$$invalidate(3, field.style.width = '0px', field);
		$$invalidate(3, field.style.width = field.scrollWidth + 2 + 'px', field);
	};

	// color to indicate good/bad input
	let savedColor = null;

	onMount(() => {
		// save the good color
		savedColor = field.style.color;

		// Set input width based on its scrollWidth (for initial value)
		setFieldWidth();
	});

	function onInput(e) {
		// reinitialize the width
		setFieldWidth();

		// Do we need to check 
		if (!check) return;

		// show disapproval when input is nok
		$$invalidate(3, field.style.color = check(e.target.value) ? savedColor : badInputColor, field);
	}

	function input_1_input_handler() {
		input = this.value;
		$$invalidate(0, input);
	}

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			field = $$value;
			$$invalidate(3, field);
		});
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(1, label = $$props.label);
		if ('input' in $$props) $$invalidate(0, input = $$props.input);
		if ('style' in $$props) $$invalidate(2, style = $$props.style);
		if ('check' in $$props) $$invalidate(6, check = $$props.check);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*field*/ 8) {
			// Reactive: update width whenever input changes and field is available
			if (field) setFieldWidth();
		}
	};

	return [
		input,
		label,
		style,
		field,
		fid,
		onInput,
		check,
		input_1_input_handler,
		input_1_binding
	];
}

class Label_input_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$7, create_fragment$7, safe_not_equal, { label: 1, input: 0, style: 2, check: 6 });
	}
}

/* nodes\name-path\name-path.svelte generated by Svelte v4.2.20 */

function create_default_slot$4(ctx) {
	let labelinputfield0;
	let updating_input;
	let t;
	let labelinputfield1;
	let updating_input_1;
	let current;

	function labelinputfield0_input_binding(value) {
		/*labelinputfield0_input_binding*/ ctx[6](value);
	}

	let labelinputfield0_props = {
		label: "Name",
		style: "width: 3rem;",
		check: null
	};

	if (/*_name*/ ctx[1] !== void 0) {
		labelinputfield0_props.input = /*_name*/ ctx[1];
	}

	labelinputfield0 = new Label_input_field({ props: labelinputfield0_props });
	binding_callbacks.push(() => bind(labelinputfield0, 'input', labelinputfield0_input_binding));

	function labelinputfield1_input_binding(value) {
		/*labelinputfield1_input_binding*/ ctx[7](value);
	}

	let labelinputfield1_props = {
		label: "Path",
		style: "width: 3rem;",
		check: /*checkPath*/ ctx[3]
	};

	if (/*_path*/ ctx[2] !== void 0) {
		labelinputfield1_props.input = /*_path*/ ctx[2];
	}

	labelinputfield1 = new Label_input_field({ props: labelinputfield1_props });
	binding_callbacks.push(() => bind(labelinputfield1, 'input', labelinputfield1_input_binding));

	return {
		c() {
			create_component(labelinputfield0.$$.fragment);
			t = space();
			create_component(labelinputfield1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(labelinputfield0, target, anchor);
			insert(target, t, anchor);
			mount_component(labelinputfield1, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const labelinputfield0_changes = {};

			if (!updating_input && dirty & /*_name*/ 2) {
				updating_input = true;
				labelinputfield0_changes.input = /*_name*/ ctx[1];
				add_flush_callback(() => updating_input = false);
			}

			labelinputfield0.$set(labelinputfield0_changes);
			const labelinputfield1_changes = {};

			if (!updating_input_1 && dirty & /*_path*/ 4) {
				updating_input_1 = true;
				labelinputfield1_changes.input = /*_path*/ ctx[2];
				add_flush_callback(() => updating_input_1 = false);
			}

			labelinputfield1.$set(labelinputfield1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(labelinputfield0.$$.fragment, local);
			transition_in(labelinputfield1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(labelinputfield0.$$.fragment, local);
			transition_out(labelinputfield1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(labelinputfield0, detaching);
			destroy_component(labelinputfield1, detaching);
		}
	};
}

function create_fragment$6(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$4] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _path, _name*/ 518) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// local copies of the 
	let _name = '';

	let _path = '';
	let _regex = '';

	function checkPath(str) {
		// if we need to test the input..
		if (!_regex) return true;

		// test the input against the regex
		return _regex.test?.(str);
	}

	onMount(() => {
		tx.send("modal div", box.div);
	});

	const handlers = {
		onNameAndPath({ title, pos, name, path, regex, ok, cancel, open, trash }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(
				0,
				box.ok = () => {
					ok?.(_name, _path);
				},
				box
			);

			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			$$invalidate(
				0,
				box.open = e => {
					open?.(_name, _path);
					box.hide();
				},
				box
			);

			$$invalidate(0, box.trash = trash ? () => trash() : null, box);

			// the name field
			$$invalidate(1, _name = name);

			$$invalidate(2, _path = path);
			_regex = regex;

			// show the popup
			box.show(pos);
		}
	};

	function labelinputfield0_input_binding(value) {
		_name = value;
		$$invalidate(1, _name);
	}

	function labelinputfield1_input_binding(value) {
		_path = value;
		$$invalidate(2, _path);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(4, tx = $$props.tx);
	};

	return [
		box,
		_name,
		_path,
		checkPath,
		tx,
		handlers,
		labelinputfield0_input_binding,
		labelinputfield1_input_binding
	];
}

class Name_path extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { tx: 4, handlers: 5 });
	}

	get handlers() {
		return this.$$.ctx[5];
	}
}

/* nodes\path-request\path.svelte generated by Svelte v4.2.20 */

function create_default_slot$3(ctx) {
	let labelinputfield;
	let updating_input;
	let current;

	function labelinputfield_input_binding(value) {
		/*labelinputfield_input_binding*/ ctx[5](value);
	}

	let labelinputfield_props = {
		label: "Path :",
		style: "width: 2rem;",
		check: /*checkPath*/ ctx[2]
	};

	if (/*_path*/ ctx[1] !== void 0) {
		labelinputfield_props.input = /*_path*/ ctx[1];
	}

	labelinputfield = new Label_input_field({ props: labelinputfield_props });
	binding_callbacks.push(() => bind(labelinputfield, 'input', labelinputfield_input_binding));

	return {
		c() {
			create_component(labelinputfield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(labelinputfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const labelinputfield_changes = {};

			if (!updating_input && dirty & /*_path*/ 2) {
				updating_input = true;
				labelinputfield_changes.input = /*_path*/ ctx[1];
				add_flush_callback(() => updating_input = false);
			}

			labelinputfield.$set(labelinputfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(labelinputfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(labelinputfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(labelinputfield, detaching);
		}
	};
}

function create_fragment$5(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$3] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _path*/ 130) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// local copies of the 
	let _path;

	function checkPath(str) {
		// if we need to test the input..
		return true;
	}

	onMount(() => {
		tx.send("modal div", box.div);
	});

	const handlers = {
		// The uid is the uid of the node for which the popup is opened
		"-> path"({ title, path, pos, ok, cancel }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(0, box.ok = ok ? () => ok(_path) : null, box);
			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			// the path field
			$$invalidate(1, _path = path);

			// show the popup
			box.show();
		}
	};

	function labelinputfield_input_binding(value) {
		_path = value;
		$$invalidate(1, _path);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(3, tx = $$props.tx);
	};

	return [box, _path, checkPath, tx, handlers, labelinputfield_input_binding];
}

class Path extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, { tx: 3, handlers: 4 });
	}

	get handlers() {
		return this.$$.ctx[4];
	}
}

/* nodes\single-text-field\single-text-field.svelte generated by Svelte v4.2.20 */

function create_default_slot$2(ctx) {
	let textfield;
	let updating_text;
	let current;

	function textfield_text_binding(value) {
		/*textfield_text_binding*/ ctx[4](value);
	}

	let textfield_props = { style: null, check: null };

	if (/*_text*/ ctx[1] !== void 0) {
		textfield_props.text = /*_text*/ ctx[1];
	}

	textfield = new Text_field({ props: textfield_props });
	binding_callbacks.push(() => bind(textfield, 'text', textfield_text_binding));

	return {
		c() {
			create_component(textfield.$$.fragment);
		},
		m(target, anchor) {
			mount_component(textfield, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const textfield_changes = {};

			if (!updating_text && dirty & /*_text*/ 2) {
				updating_text = true;
				textfield_changes.text = /*_text*/ ctx[1];
				add_flush_callback(() => updating_text = false);
			}

			textfield.$set(textfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(textfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(textfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(textfield, detaching);
		}
	};
}

function create_fragment$4(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$2] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _text*/ 34) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	// the popup box data
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	let _text = '';

	onMount(() => {
		tx.send("modal div", box.div);
	});

	const handlers = {
		// The uid is the uid of the node for which the popup is opened
		"-> show"({ label, value, pos, ok, cancel }) {
			// The box 
			($$invalidate(0, box.title = label, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(0, box.ok = ok ? () => ok(_text) : null, box);
			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			// the text 
			$$invalidate(1, _text = value);

			// show the popup
			box.show(box.pos);
		}
	};

	function textfield_text_binding(value) {
		_text = value;
		$$invalidate(1, _text);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(2, tx = $$props.tx);
	};

	return [box, _text, tx, handlers, textfield_text_binding];
}

class Single_text_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, { tx: 2, handlers: 3 });
	}

	get handlers() {
		return this.$$.ctx[3];
	}
}

/* fragments\label-info-field.svelte generated by Svelte v4.2.20 */

function create_fragment$3(ctx) {
	let div;
	let label_1;
	let t0;
	let t1;
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			label_1 = element("label");
			t0 = text(/*label*/ ctx[1]);
			t1 = space();
			input = element("input");
			attr(label_1, "for", /*fid*/ ctx[3]);
			attr(label_1, "style", /*style*/ ctx[2]);
			attr(label_1, "class", "svelte-1tr5m2d");
			attr(input, "id", /*fid*/ ctx[3]);
			attr(input, "type", "text");
			attr(input, "spellcheck", "false");
			input.readOnly = true;
			attr(input, "class", "svelte-1tr5m2d");
			attr(div, "class", "input-field svelte-1tr5m2d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label_1);
			append(label_1, t0);
			append(div, t1);
			append(div, input);
			set_input_value(input, /*info*/ ctx[0]);

			if (!mounted) {
				dispose = listen(input, "input", /*input_input_handler*/ ctx[4]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 2) set_data(t0, /*label*/ ctx[1]);

			if (dirty & /*style*/ 4) {
				attr(label_1, "style", /*style*/ ctx[2]);
			}

			if (dirty & /*info*/ 1 && input.value !== /*info*/ ctx[0]) {
				set_input_value(input, /*info*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			dispose();
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { label, info, style } = $$props;
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {
		
	});

	function input_input_handler() {
		info = this.value;
		$$invalidate(0, info);
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(1, label = $$props.label);
		if ('info' in $$props) $$invalidate(0, info = $$props.info);
		if ('style' in $$props) $$invalidate(2, style = $$props.style);
	};

	return [info, label, style, fid, input_input_handler];
}

class Label_info_field extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { label: 1, info: 0, style: 2 });
	}
}

/* fragments\color-picker.svelte generated by Svelte v4.2.20 */

function create_fragment$2(ctx) {
	let div;
	let label_1;
	let t0;
	let t1;
	let input_1;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			label_1 = element("label");
			t0 = text(/*label*/ ctx[1]);
			t1 = space();
			input_1 = element("input");
			attr(label_1, "for", /*fid*/ ctx[4]);
			attr(label_1, "style", /*style*/ ctx[2]);
			attr(label_1, "class", "svelte-2bjr9q");
			attr(input_1, "id", /*fid*/ ctx[4]);
			attr(input_1, "type", "color");
			attr(input_1, "class", "svelte-2bjr9q");
			attr(div, "class", "color-field svelte-2bjr9q");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label_1);
			append(label_1, t0);
			append(div, t1);
			append(div, input_1);
			set_input_value(input_1, /*color*/ ctx[0]);
			/*input_1_binding*/ ctx[8](input_1);

			if (!mounted) {
				dispose = [
					listen(input_1, "input", /*input_1_input_handler*/ ctx[7]),
					listen(input_1, "input", /*onInput*/ ctx[5])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 2) set_data(t0, /*label*/ ctx[1]);

			if (dirty & /*style*/ 4) {
				attr(label_1, "style", /*style*/ ctx[2]);
			}

			if (dirty & /*color*/ 1) {
				set_input_value(input_1, /*color*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			/*input_1_binding*/ ctx[8](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { label } = $$props;
	let { style } = $$props;
	let { color } = $$props;
	let { onColor } = $$props;
	let input;

	// random field id
	let fid = 'f' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

	onMount(() => {
		
	});

	// call the on color function if requested
	function onInput(e) {
		onColor?.(color);
	}

	function input_1_input_handler() {
		color = this.value;
		$$invalidate(0, color);
	}

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			input = $$value;
			$$invalidate(3, input);
		});
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(1, label = $$props.label);
		if ('style' in $$props) $$invalidate(2, style = $$props.style);
		if ('color' in $$props) $$invalidate(0, color = $$props.color);
		if ('onColor' in $$props) $$invalidate(6, onColor = $$props.onColor);
	};

	return [
		color,
		label,
		style,
		input,
		fid,
		onInput,
		onColor,
		input_1_input_handler,
		input_1_binding
	];
}

class Color_picker extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { label: 1, style: 2, color: 0, onColor: 6 });
	}
}

/* nodes\document-settings\document-settings.svelte generated by Svelte v4.2.20 */

function create_default_slot$1(ctx) {
	let labelinfofield0;
	let t0;
	let labelinfofield1;
	let t1;
	let labelinfofield2;
	let t2;
	let labelinfofield3;
	let t3;
	let labelinputfield;
	let updating_input;
	let t4;
	let colorpicker;
	let current;

	labelinfofield0 = new Label_info_field({
			props: {
				label: "File:",
				style: "width: 6rem;",
				info: /*_path*/ ctx[1]
			}
		});

	labelinfofield1 = new Label_info_field({
			props: {
				label: "Vmblu Version:",
				style: "width: 6rem;",
				info: /*_version*/ ctx[3]
			}
		});

	labelinfofield2 = new Label_info_field({
			props: {
				label: "Creation Date:",
				style: "width: 6rem;",
				info: /*_created*/ ctx[2]
			}
		});

	labelinfofield3 = new Label_info_field({
			props: {
				label: "Last Saved:",
				style: "width: 6rem;",
				info: /*_saved*/ ctx[4]
			}
		});

	function labelinputfield_input_binding(value) {
		/*labelinputfield_input_binding*/ ctx[10](value);
	}

	let labelinputfield_props = {
		label: "Runtime",
		style: "width: 6rem;",
		check: null
	};

	if (/*_runtime*/ ctx[6] !== void 0) {
		labelinputfield_props.input = /*_runtime*/ ctx[6];
	}

	labelinputfield = new Label_input_field({ props: labelinputfield_props });
	binding_callbacks.push(() => bind(labelinputfield, 'input', labelinputfield_input_binding));

	colorpicker = new Color_picker({
			props: {
				label: "Node Color:",
				style: "width: 6rem;",
				color: /*_color*/ ctx[5],
				onColor: /*_onColor*/ ctx[7]
			}
		});

	return {
		c() {
			create_component(labelinfofield0.$$.fragment);
			t0 = space();
			create_component(labelinfofield1.$$.fragment);
			t1 = space();
			create_component(labelinfofield2.$$.fragment);
			t2 = space();
			create_component(labelinfofield3.$$.fragment);
			t3 = space();
			create_component(labelinputfield.$$.fragment);
			t4 = space();
			create_component(colorpicker.$$.fragment);
		},
		m(target, anchor) {
			mount_component(labelinfofield0, target, anchor);
			insert(target, t0, anchor);
			mount_component(labelinfofield1, target, anchor);
			insert(target, t1, anchor);
			mount_component(labelinfofield2, target, anchor);
			insert(target, t2, anchor);
			mount_component(labelinfofield3, target, anchor);
			insert(target, t3, anchor);
			mount_component(labelinputfield, target, anchor);
			insert(target, t4, anchor);
			mount_component(colorpicker, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const labelinfofield0_changes = {};
			if (dirty & /*_path*/ 2) labelinfofield0_changes.info = /*_path*/ ctx[1];
			labelinfofield0.$set(labelinfofield0_changes);
			const labelinfofield1_changes = {};
			if (dirty & /*_version*/ 8) labelinfofield1_changes.info = /*_version*/ ctx[3];
			labelinfofield1.$set(labelinfofield1_changes);
			const labelinfofield2_changes = {};
			if (dirty & /*_created*/ 4) labelinfofield2_changes.info = /*_created*/ ctx[2];
			labelinfofield2.$set(labelinfofield2_changes);
			const labelinfofield3_changes = {};
			if (dirty & /*_saved*/ 16) labelinfofield3_changes.info = /*_saved*/ ctx[4];
			labelinfofield3.$set(labelinfofield3_changes);
			const labelinputfield_changes = {};

			if (!updating_input && dirty & /*_runtime*/ 64) {
				updating_input = true;
				labelinputfield_changes.input = /*_runtime*/ ctx[6];
				add_flush_callback(() => updating_input = false);
			}

			labelinputfield.$set(labelinputfield_changes);
			const colorpicker_changes = {};
			if (dirty & /*_color*/ 32) colorpicker_changes.color = /*_color*/ ctx[5];
			if (dirty & /*_onColor*/ 128) colorpicker_changes.onColor = /*_onColor*/ ctx[7];
			colorpicker.$set(colorpicker_changes);
		},
		i(local) {
			if (current) return;
			transition_in(labelinfofield0.$$.fragment, local);
			transition_in(labelinfofield1.$$.fragment, local);
			transition_in(labelinfofield2.$$.fragment, local);
			transition_in(labelinfofield3.$$.fragment, local);
			transition_in(labelinputfield.$$.fragment, local);
			transition_in(colorpicker.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(labelinfofield0.$$.fragment, local);
			transition_out(labelinfofield1.$$.fragment, local);
			transition_out(labelinfofield2.$$.fragment, local);
			transition_out(labelinfofield3.$$.fragment, local);
			transition_out(labelinputfield.$$.fragment, local);
			transition_out(colorpicker.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
				detach(t2);
				detach(t3);
				detach(t4);
			}

			destroy_component(labelinfofield0, detaching);
			destroy_component(labelinfofield1, detaching);
			destroy_component(labelinfofield2, detaching);
			destroy_component(labelinfofield3, detaching);
			destroy_component(labelinputfield, detaching);
			destroy_component(colorpicker, detaching);
		}
	};
}

function create_fragment$1(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[0],
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};
			if (dirty & /*box*/ 1) popupbox_changes.box = /*box*/ ctx[0];

			if (dirty & /*$$scope, _color, _onColor, _runtime, _saved, _created, _version, _path*/ 2302) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx

	// the popup box
	let box = {
		div: null,
		pos: null,
		title: '',
		ok: null,
		cancel: null
	};

	// The local data
	let _path, _created, _version, _saved, _color, _runtime, _onColor;

	onMount(() => {
		// send the box div
		tx.send('modal div', box.div);
	});

	const handlers = {
		// Settings is the link header of the document
		"-> show"({ title, path, settings, pos, ok, cancel, onColor }) {
			// The box 
			($$invalidate(0, box.title = title, box), $$invalidate(0, box.pos = { ...pos }, box));

			$$invalidate(0, box.ok = ok ? () => ok(_runtime) : null, box);
			$$invalidate(0, box.cancel = cancel ? () => cancel() : null, box);

			// The field settings
			$$invalidate(1, _path = path);

			$$invalidate(3, _version = settings.version);
			$$invalidate(2, _created = settings.created);
			$$invalidate(4, _saved = settings.saved);
			$$invalidate(6, _runtime = settings.runtime);
			$$invalidate(5, _color = settings.style.rgb);
			$$invalidate(7, _onColor = onColor);

			// and show
			box.show(pos);
		}
	};

	function labelinputfield_input_binding(value) {
		_runtime = value;
		$$invalidate(6, _runtime);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(8, tx = $$props.tx);
	};

	return [
		box,
		_path,
		_created,
		_version,
		_saved,
		_color,
		_runtime,
		_onColor,
		tx,
		handlers,
		labelinputfield_input_binding
	];
}

class Document_settings extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { tx: 8, handlers: 9 });
	}

	get handlers() {
		return this.$$.ctx[9];
	}
}

const maxColSize = 20;

function alfa(str) {
return str
}

function NodeList(tx) {

    this.tx = tx;

    // cols is an array of arrays
    this.cols = [];
    this.xyLocal = {x:0, y:0};

}
NodeList.prototype = {

    // a function to init the cols array - just counts the number of columns that are required
    init(libMap) {

        // reset 
        this.cols = [];

        // the nr of cols we have so far
        let colNr = 0;

        // the size remaining in a col
        let colRemaining = maxColSize;

        // all the first level nodes in the links
        for(const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

            // if we have enough place for the entire linkmap, we add it to the current column
            const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1;

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++;
                colRemaining = maxColSize;
            }
            colRemaining -= libSize;
        }

        // set the nr of cols
        colNr++;
        while (colNr-- > 0) this.cols.push([]);
    },

    fill(libMap) {

        // notation
        const cols = this.cols;

        // The col nr 
        let colNr = 0;

        // The remaining size in the col
        let colRemaining = maxColSize;

        // make the cols to display
        for (const model of libMap.values()) {

            // the model must be selectable
            if ( ! model.is.selectable || ! model.raw ) return

           // if we have enough place for the entire linkmap, we add it to the current column
           const libSize = model.raw.root.nodes ? model.raw.root.nodes.length : 1;

            // switch to new column if not enough space
            if (libSize > colRemaining && colRemaining < maxColSize) {
                colNr++;
                colRemaining = maxColSize;
            }
            colRemaining -= libSize;

            // The name of the library comes first
            cols[colNr].push({nextModel:true, model, expanded:true});

            // The nodes in the library
            if (model.raw.root.nodes) 
                for (const node of model.raw.root.nodes) cols[colNr].push({model, node, expanded:false});
            else 
                cols[colNr].push({model, node: model.raw.root, expanded:false});
        }
    },

    onRemoveLib(e) {

        // get the index of the node clicked
        const iCol  = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;

        // get the model in the table
        const entry = this.cols[iCol]?.[iNode];
    
        // check
        if ( ! entry?.nextModel ) return

        // message with file to remove
        this.tx.send('remove file', {model: entry.model});
    },
    
    addLib(e) {
    
        const pos = {x:e.screenX, y:e.screenY};
        this.tx.send('get path',  { title:'add file to node library', 
                                    path:null, 
                                    pos,
                                    ok:(userPath) => {
                                        this.tx.send('add file',userPath);
                                    },
                                    cancel:null
                                });
    },

    onSelect(e, box){

        // hide the modal box
        box.hide();
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;
        const iSub = e.target.parentNode.dataset?.sub;
    
        // get the model
        const model = this.cols[iCol][iNode].model;

        // by default the groupName is empty
        let groupName = '';
    
        // get the node in the col
        let rawNode = this.cols[iCol][iNode].node;
    
        // if a subnode was selected, get it and save the groupNode
        if (iSub) {
            groupName = rawNode.group;
            rawNode = rawNode.nodes.find( (sub,i) => i==iSub);
        }
    
        // check
        if (!rawNode) return

        // the name of the selected node
        const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock;

        // make the full node name
        const nodePath = groupName.length == 0 ? nodeName : groupName + '|' + nodeName;
    
        // return the selected node to the 
        this.tx.send("selected node",{model, nodePath, xyLocal:this.xyLocal});
    },
    
    onArrowClick(e) {
    
        // get the index of the node clicked
        const iCol = e.target.parentNode.dataset?.col;
        const iNode = e.target.parentNode.dataset?.node;
    
        // toggle the expanded boolean...
        this.cols[iCol][iNode].expanded = !this.cols[iCol][iNode].expanded;
    }

};

/* nodes\node-selector\node-selector.svelte generated by Svelte v4.2.20 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i];
	child_ctx[9] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[10] = list[i];
	child_ctx[12] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[13] = list[i];
	child_ctx[15] = i;
	return child_ctx;
}

// (215:41) 
function create_if_block_2(ctx) {
	let if_block_anchor;

	function select_block_type_2(ctx, dirty) {
		if (/*entry*/ ctx[10].node.source) return create_if_block_3;
		if (/*entry*/ ctx[10].node.dock) return create_if_block_4;
		if (/*entry*/ ctx[10].node.group) return create_if_block_5;
	}

	let current_block_type = select_block_type_2(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) {
				if_block.d(detaching);
			}
		}
	};
}

// (205:20) {#if entry.nextModel}
function create_if_block(ctx) {
	let div;
	let show_if;

	function select_block_type_1(ctx, dirty) {
		if (dirty & /*nodeList*/ 1) show_if = null;
		if (show_if == null) show_if = !!(/*entry*/ ctx[10].model.getArl()?.getExt() === 'js');
		if (show_if) return create_if_block_1;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx, -1);
	let if_block = current_block_type(ctx);

	return {
		c() {
			div = element("div");
			if_block.c();
			attr(div, "class", "arl svelte-kfxdt6");
			attr(div, "data-col", /*iCol*/ ctx[9]);
			attr(div, "data-node", /*iNode*/ ctx[12]);
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if_block.m(div, null);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_1(ctx, dirty)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div, null);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if_block.d();
		}
	};
}

// (226:51) 
function create_if_block_5(ctx) {
	let if_block_anchor;

	function select_block_type_3(ctx, dirty) {
		if (/*entry*/ ctx[10].expanded) return create_if_block_6;
		return create_else_block_1;
	}

	let current_block_type = select_block_type_3(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_block.d(detaching);
		}
	};
}

// (221:50) 
function create_if_block_4(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*entry*/ ctx[10].node.dock) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "factory";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[10].node.dock) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (216:24) {#if entry.node.source}
function create_if_block_3(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*entry*/ ctx[10].node.source) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "factory";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[10].node.source) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (251:28) {:else}
function create_else_block_1(ctx) {
	let p;
	let i;
	let t1;
	let span0;
	let t2_value = alfa(/*entry*/ ctx[10].node.group) + "";
	let t2;
	let t3;
	let span1;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			span1 = element("span");
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span0, "class", "node-name svelte-kfxdt6");
			attr(span1, "class", "arrow svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span0);
			append(span0, t2);
			append(p, t3);
			append(p, span1);
			span1.innerHTML = arrowRight;

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span0, "click", /*onArrowClick*/ ctx[4]),
					listen(span0, "keydown", onKeydown),
					listen(span1, "click", /*onArrowClick*/ ctx[4]),
					listen(span1, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[10].node.group) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (227:28) {#if entry.expanded}
function create_if_block_6(ctx) {
	let p;
	let i;
	let t1;
	let span0;
	let t2_value = alfa(/*entry*/ ctx[10].node.group) + "";
	let t2;
	let t3;
	let span1;
	let t4;
	let each_1_anchor;
	let mounted;
	let dispose;
	let each_value_2 = ensure_array_like(/*entry*/ ctx[10].node.nodes);
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			span1 = element("span");
			t4 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span0, "class", "node-name svelte-kfxdt6");
			attr(span1, "class", "arrow svelte-kfxdt6");
			attr(p, "class", "node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span0);
			append(span0, t2);
			append(p, t3);
			append(p, span1);
			span1.innerHTML = arrowDown;
			insert(target, t4, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span0, "click", /*onArrowClick*/ ctx[4]),
					listen(span0, "keydown", onKeydown),
					listen(span1, "click", /*onArrowClick*/ ctx[4]),
					listen(span1, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*entry*/ ctx[10].node.group) + "")) set_data(t2, t2_value);

			if (dirty & /*onSelect, onKeydown, nodeList*/ 9) {
				each_value_2 = ensure_array_like(/*entry*/ ctx[10].node.nodes);
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(p);
				detach(t4);
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (244:55) 
function create_if_block_9(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*sub*/ ctx[13].dock) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "sub-node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
			attr(p, "data-sub", /*iSub*/ ctx[15]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*sub*/ ctx[13].dock) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (239:56) 
function create_if_block_8(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*sub*/ ctx[13].group) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "account_tree";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "sub-node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
			attr(p, "data-sub", /*iSub*/ ctx[15]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*sub*/ ctx[13].group) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (234:36) {#if sub.source}
function create_if_block_7(ctx) {
	let p;
	let i;
	let t1;
	let span;
	let t2_value = alfa(/*sub*/ ctx[13].source) + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			p = element("p");
			i = element("i");
			i.textContent = "factory";
			t1 = space();
			span = element("span");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined icon svelte-kfxdt6");
			attr(span, "class", "node-name svelte-kfxdt6");
			attr(p, "class", "sub-node svelte-kfxdt6");
			attr(p, "data-col", /*iCol*/ ctx[9]);
			attr(p, "data-node", /*iNode*/ ctx[12]);
			attr(p, "data-sub", /*iSub*/ ctx[15]);
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, i);
			append(p, t1);
			append(p, span);
			append(span, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onSelect*/ ctx[3]),
					listen(i, "keydown", onKeydown),
					listen(span, "click", /*onSelect*/ ctx[3]),
					listen(span, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = alfa(/*sub*/ ctx[13].source) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (233:32) {#each entry.node.nodes as sub, iSub}
function create_each_block_2(ctx) {
	let if_block_anchor;

	function select_block_type_4(ctx, dirty) {
		if (/*sub*/ ctx[13].source) return create_if_block_7;
		if (/*sub*/ ctx[13].group) return create_if_block_8;
		if (/*sub*/ ctx[13].dock) return create_if_block_9;
	}

	let current_block_type = select_block_type_4(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_4(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) {
				if_block.d(detaching);
			}
		}
	};
}

// (210:24) {:else}
function create_else_block(ctx) {
	let i;
	let t1;
	let p;
	let t2_value = /*entry*/ ctx[10].model.getArl().getName() + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "cancel";
			t1 = space();
			p = element("p");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined lib lib-json svelte-kfxdt6");
			attr(p, "class", "lib lib-json svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, i, anchor);
			insert(target, t1, anchor);
			insert(target, p, anchor);
			append(p, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onRemoveLib*/ ctx[2]),
					listen(i, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = /*entry*/ ctx[10].model.getArl().getName() + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(i);
				detach(t1);
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (207:24) {#if entry.model.getArl()?.getExt() === 'js'}
function create_if_block_1(ctx) {
	let i;
	let t1;
	let p;
	let t2_value = /*entry*/ ctx[10].model.getArl().getName() + "";
	let t2;
	let mounted;
	let dispose;

	return {
		c() {
			i = element("i");
			i.textContent = "cancel";
			t1 = space();
			p = element("p");
			t2 = text(t2_value);
			attr(i, "class", "material-icons-outlined lib lib-js svelte-kfxdt6");
			attr(p, "class", "lib lib-js svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, i, anchor);
			insert(target, t1, anchor);
			insert(target, p, anchor);
			append(p, t2);

			if (!mounted) {
				dispose = [
					listen(i, "click", /*onRemoveLib*/ ctx[2]),
					listen(i, "keydown", onKeydown)
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList*/ 1 && t2_value !== (t2_value = /*entry*/ ctx[10].model.getArl().getName() + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(i);
				detach(t1);
				detach(p);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (204:16) {#each col as entry, iNode}
function create_each_block_1(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*entry*/ ctx[10].nextModel) return create_if_block;
		if (/*entry*/ ctx[10].node) return create_if_block_2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type && current_block_type(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if (if_block) if_block.d(1);
				if_block = current_block_type && current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) {
				if_block.d(detaching);
			}
		}
	};
}

// (202:8) {#each nodeList.cols as col, iCol}
function create_each_block(ctx) {
	let div;
	let t;
	let each_value_1 = ensure_array_like(/*col*/ ctx[7]);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
			attr(div, "class", "column svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList, onRemoveLib, onKeydown, onSelect, onArrowClick, arrowDown, arrowRight*/ 29) {
				each_value_1 = ensure_array_like(/*col*/ ctx[7]);
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, t);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (200:0) <PopupBox box = {box}>
function create_default_slot(ctx) {
	let div;
	let each_value = ensure_array_like(/*nodeList*/ ctx[0].cols);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "content svelte-kfxdt6");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}
		},
		p(ctx, dirty) {
			if (dirty & /*nodeList, onRemoveLib, onKeydown, onSelect, onArrowClick, arrowDown, arrowRight*/ 29) {
				each_value = ensure_array_like(/*nodeList*/ ctx[0].cols);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

function create_fragment(ctx) {
	let popupbox;
	let current;

	popupbox = new Popup_box({
			props: {
				box: /*box*/ ctx[1],
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(popupbox.$$.fragment);
		},
		m(target, anchor) {
			mount_component(popupbox, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const popupbox_changes = {};

			if (dirty & /*$$scope, nodeList*/ 65537) {
				popupbox_changes.$$scope = { dirty, ctx };
			}

			popupbox.$set(popupbox_changes);
		},
		i(local) {
			if (current) return;
			transition_in(popupbox.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(popupbox.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(popupbox, detaching);
		}
	};
}

const arrowRight = "&#9656;";
const arrowDown = "&#9662;";

function onKeydown(e) {
	
}

function instance($$self, $$props, $$invalidate) {
	let { tx } = $$props; //, sx
	let nodeList = new NodeList(tx);

	let box = {
		div: null,
		title: 'Select Node',
		pos: null,
		ok: null,
		cancel: null,
		add: e => nodeList.addLib(e)
	};

	onMount(async () => {
		// send the box div
		tx.send('modal div', box.div);
	});

	const handlers = {
		onBuildTable(libMap) {
			nodeList.init(libMap);
			nodeList.fill(libMap);

			// if visible, refresh
			if (box.div?.style.display == 'block') $$invalidate(0, nodeList);
		},
		onShow({ xyScreen, xyLocal }) {
			// save the coord where the node will be created 
			$$invalidate(0, nodeList.xyLocal.x = xyLocal.x, nodeList);

			$$invalidate(0, nodeList.xyLocal.y = xyLocal.y, nodeList);

			//show the box at the right coordinates
			box.show({ x: xyScreen.x + 10, y: xyScreen.y + 10 });
		}
	};

	function onRemoveLib(e) {
		nodeList.onRemoveLib(e);
		$$invalidate(0, nodeList);
	}

	function onSelect(e) {
		nodeList.onSelect(e, box);
		$$invalidate(0, nodeList);
	}

	function onArrowClick(e) {
		nodeList.onArrowClick(e);
		$$invalidate(0, nodeList);
	}

	$$self.$$set = $$props => {
		if ('tx' in $$props) $$invalidate(5, tx = $$props.tx);
	};

	return [nodeList, box, onRemoveLib, onSelect, onArrowClick, tx, handlers];
}

class Node_selector extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { tx: 5, handlers: 6 });
	}

	get handlers() {
		return this.$$.ctx[6];
	}
}

// // Returns a factory function for the svelte component
// function xxgetFactory( svelteDef, htmlTarget=null) {
// 	return function (tx, sx) {

// 		const component = new svelteDef({
// 			target: htmlTarget ?? document.createElement('div'),
// 			props: {
// 				tx, sx, handlers:null
// 			}
// 		})
// 		return component.handlers
// 	}
// }

// returns a factory function for teh sveltecomponent
function getFactory( svelteComponent, htmlTarget=null) {

	return function (tx, sx) {

		const mountFn = undefined;
		const node = typeof mountFn === 'function'
			? mountFn(svelteComponent, {
				target: htmlTarget ?? document.createElement("div"),
				props: { tx, sx }
			})
			: new svelteComponent({
			target: htmlTarget ?? document.createElement("div"),
			props: { tx, sx }
		});

		// return the handlers of the cell
		return node.handlers
	}
}
const MenuTabsWindow = getFactory(Menu_tabs_window);
const CanvasLayoutFactory = getFactory(Canvas_layout, document.body);
const LeftMenuLayoutFactory = getFactory(Left_menu_layout, document.body);
const ColumnMainFactory = getFactory(Column_main, document.body);
const TopMenuFactory = getFactory(Top_menu);
const SideMenuFactory = getFactory(Side_menu);
const TabRibbonFactory = getFactory(Tab_ribbon);
const VscodeSideMenuFactory = getFactory(Vscode_side_menu);
const RuntimeSettingsFactory = getFactory(Runtime_settings);
const ConfirmBox = getFactory(Confirm_box);
const ContextMenuFactory = getFactory(Context_menu);
const JsonInputFactory = getFactory(Json_area_input);
const TextBlockFactory = getFactory(Text_area_input);
const PinProfileFactory = getFactory(Pin_profile);
const MessageBoxFactory = getFactory(Message_box);
const NameAndPathFactory = getFactory(Name_path);
const PathRequestFactory = getFactory(Path);
const SingleTextFieldFactory = getFactory(Single_text_field);
const DocumentSettingsFactory = getFactory(Document_settings);
const NodeSelectorFactory = getFactory(Node_selector);

var svelteLib_mod = "{\n  \"header\": {\n    \"version\": \"no version\",\n    \"created\": \"4/2/2024, 12:51:45 PM\",\n    \"saved\": \"12/16/2025, 1:00:06 PM\",\n    \"utc\": \"2025-12-16T12:00:06.433Z\",\n    \"runtime\": \"./runtime.js\"\n  },\n  \"factories\": [\n    {\n      \"path\": \"./index.js\",\n      \"function\": \"ContextMenuFactory\"\n    }\n  ],\n  \"root\": {\n    \"kind\": \"group\",\n    \"name\": \"\",\n    \"nodes\": [\n      {\n        \"kind\": \"group\",\n        \"name\": \"modal boxes\",\n        \"nodes\": [\n          {\n            \"kind\": \"source\",\n            \"name\": \"context menu\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"ContextMenuFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"context menu\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"path request\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"PathRequestFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"path\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"single text field\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"SingleTextFieldFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"message box\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"MessageBoxFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"json input\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"JsonInputFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"json\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"text block\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"TextBlockFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"text\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"node selector\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"NodeSelectorFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"build table\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"selected node\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"get path\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"add file\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"remove file\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"name and path\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"NameAndPathFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"name and path\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"document settings\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"DocumentSettingsFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"confirm box\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"ConfirmBox\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"runtime settings\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"RuntimeSettingsFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"pin profile\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"PinProfileFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          }\n        ]\n      },\n      {\n        \"kind\": \"group\",\n        \"name\": \"page layout group\",\n        \"nodes\": [\n          {\n            \"kind\": \"source\",\n            \"name\": \"canvas layout\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"CanvasLayoutFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"menu\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tab ribbon\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"workspace\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"canvas\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"canvas size change\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"menu tabs window\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"MenuTabsWindow\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"menu div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tabs div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"content div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"content size change\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"size change\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"left menu layout\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"LeftMenuLayoutFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"screen areas\",\n                \"pins\": [\n                  {\n                    \"name\": \"left menu\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"left column\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"area one\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"area two\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              },\n              {\n                \"interface\": \"messages\",\n                \"pins\": [\n                  {\n                    \"name\": \"vertical\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"horizontal\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"size change\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"column-main layout\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"ColumnMainFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"left column\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"main area\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"size change\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"vertical menu tabs content\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"VerticalMenuTabsContent\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"menu div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tabs div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"content div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"content size change\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"modal div\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"size change\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          }\n        ]\n      },\n      {\n        \"kind\": \"group\",\n        \"name\": \"menus and tab ribbons\",\n        \"nodes\": [\n          {\n            \"kind\": \"source\",\n            \"name\": \"tab ribbon\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"TabRibbonFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              },\n              {\n                \"interface\": \"tab\",\n                \"pins\": [\n                  {\n                    \"name\": \"tab new\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tab rename\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tab select\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tab remove\",\n                    \"kind\": \"input\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tab request to close\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"tab request to select\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"old top menu\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"TopMenuFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"save\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"save as\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"save all\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"accept changes\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"sync\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"recalibrate\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"make app page\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"make build lib\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"analyze model\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"run app page\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"run app in iframe\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"vertical\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"horizontal\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show code editor\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"top menu\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"TopMenuFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"save\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"save as\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"save all\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"accept changes\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"sync model\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"recalibrate\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"grid on-off\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"make app page\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"make build lib\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"run app page\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"run app in iframe\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show settings\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"set save point\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"back to save point\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"side menu\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"SideMenuFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"vertical\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"horizontal\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show code editor\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show app\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          },\n          {\n            \"kind\": \"source\",\n            \"name\": \"vscode side menu\",\n            \"factory\": {\n              \"path\": \"./index.js\",\n              \"function\": \"VscodeSideMenuFactory\"\n            },\n            \"interfaces\": [\n              {\n                \"interface\": \"\",\n                \"pins\": [\n                  {\n                    \"name\": \"div\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              },\n              {\n                \"interface\": \"menu items\",\n                \"pins\": [\n                  {\n                    \"name\": \"accept changes\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"recalibrate\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"sync\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"grid on-off\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"show settings\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"set save point\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"back to save point\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"make lib\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  },\n                  {\n                    \"name\": \"make app\",\n                    \"kind\": \"output\",\n                    \"contract\": {\n                      \"role\": \"follower\",\n                      \"payload\": \"any\"\n                    }\n                  }\n                ]\n              }\n            ]\n          }\n        ]\n      }\n    ]\n  }\n}";

export { CanvasLayoutFactory, ColumnMainFactory, ConfirmBox, ContextMenuFactory, DocumentSettingsFactory, JsonInputFactory, LeftMenuLayoutFactory, MenuTabsWindow, MessageBoxFactory, NameAndPathFactory, NodeSelectorFactory, PathRequestFactory, PinProfileFactory, RuntimeSettingsFactory, SideMenuFactory, SingleTextFieldFactory, svelteLib_mod as SvelteLib, TabRibbonFactory, TextBlockFactory, TopMenuFactory, VscodeSideMenuFactory };
//# sourceMappingURL=svelte-lib-bundle.js.map
