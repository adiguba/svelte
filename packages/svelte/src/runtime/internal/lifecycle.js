import { custom_event, wrap_handler } from './dom.js';
import { is_function, noop } from './utils.js';

export let current_component;

/** @returns {void} */
export function set_current_component(component) {
	current_component = component;
}

export function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

/**
 * Schedules a callback to run immediately before the component is updated after any state change.
 *
 * The first time the callback runs will be before the initial `onMount`
 *
 * https://svelte.dev/docs/svelte#beforeupdate
 * @param {() => any} fn
 * @returns {void}
 */
export function beforeUpdate(fn) {
	get_current_component().$$.before_update.push(fn);
}

/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs/svelte#onmount
 * @template T
 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
export function onMount(fn) {
	get_current_component().$$.on_mount.push(fn);
}

/**
 * Schedules a callback to run immediately after the component has been updated.
 *
 * The first time the callback runs will be after the initial `onMount`
 *
 * https://svelte.dev/docs/svelte#afterupdate
 * @param {() => any} fn
 * @returns {void}
 */
export function afterUpdate(fn) {
	get_current_component().$$.after_update.push(fn);
}

/**
 * Schedules a callback to run immediately before the component is unmounted.
 *
 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
 * only one that runs inside a server-side component.
 *
 * https://svelte.dev/docs/svelte#ondestroy
 * @param {() => any} fn
 * @returns {void}
 */
export function onDestroy(fn) {
	get_current_component().$$.on_destroy.push(fn);
}

/**
 * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
 *
 * Component events created with `createEventDispatcher` create a
 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
 * property and can contain any type of data.
 *
 * The event dispatcher can be typed to narrow the allowed event names and the type of the `detail` argument:
 * ```ts
 * const dispatch = createEventDispatcher<{
 *  loaded: never; // does not take a detail argument
 *  change: string; // takes a detail argument of type string, which is required
 *  optional: number | null; // takes an optional detail argument of type number
 * }>();
 * ```
 *
 * https://svelte.dev/docs/svelte#createeventdispatcher
 * @template {Record<string, any>} [EventMap=any]
 * @returns {import('./public.js').EventDispatcher<EventMap>}
 */
export function createEventDispatcher() {
	const component = get_current_component();
	return (type, detail, { cancelable = false } = {}) => {
		const callbacks = component.$$.callbacks[type];
		if (callbacks) {
			// TODO are there situations where events could be dispatched
			// in a server (non-DOM) environment?
			const event = custom_event(/** @type {string} */ (type), detail, { cancelable });
			callbacks.slice().forEach((cb) => {
				cb.f.call(component, event);
			});
			return !event.defaultPrevented;
		}
		return true;
	};
}

/**
 * Associates an arbitrary `context` object with the current component and the specified `key`
 * and returns that object. The context is then available to children of the component
 * (including slotted content) with `getContext`.
 *
 * Like lifecycle functions, this must be called during component initialisation.
 *
 * https://svelte.dev/docs/svelte#setcontext
 * @template T
 * @param {any} key
 * @param {T} context
 * @returns {T}
 */
export function setContext(key, context) {
	get_current_component().$$.context.set(key, context);
	return context;
}

/**
 * Retrieves the context that belongs to the closest parent component with the specified `key`.
 * Must be called during component initialisation.
 *
 * https://svelte.dev/docs/svelte#getcontext
 * @template T
 * @param {any} key
 * @returns {T}
 */
export function getContext(key) {
	return get_current_component().$$.context.get(key);
}

/**
 * Retrieves the whole context map that belongs to the closest parent component.
 * Must be called during component initialisation. Useful, for example, if you
 * programmatically create a component and want to pass the existing context to it.
 *
 * https://svelte.dev/docs/svelte#getallcontexts
 * @template {Map<any, any>} [T=Map<any, any>]
 * @returns {T}
 */
export function getAllContexts() {
	return get_current_component().$$.context;
}

/**
 * Checks whether a given `key` has been set in the context of a parent component.
 * Must be called during component initialisation.
 *
 * https://svelte.dev/docs/svelte#hascontext
 * @param {any} key
 * @returns {boolean}
 */
export function hasContext(key) {
	return get_current_component().$$.context.has(key);
}

/**
 * @param {string} type 
 * @param {import ('./private.d.ts').Bubble} bubble 
 * @param {import ('./private.d.ts').Callback} callback 
 */
function start_bubble(type, bubble, callback) {
	const dispose = bubble.f(callback.f, callback.o, type);
	if (dispose) {
		bubble.r.set(callback, dispose);
	}
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {import ('./private.d.ts').Bubble} bubble 
 */
function start_bubbles(comp, bubble) {
	for (const type of Object.keys(comp.$$.callbacks)) {
		comp.$$.callbacks[type].forEach( callback => start_bubble(type, bubble, callback));
	}
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 */
export function restart_all_callback(comp) {
	for (const type of Object.keys(comp.$$.callbacks)) {
		for (const callback of comp.$$.callbacks[type]) {
			start_callback(comp, type, callback);
		}
	}
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {string} type
 * @param {import ('./private.d.ts').Callback} callback 
 */
function start_callback(comp, type, callback) {
	for (const bubbles of [ comp.$$.bubbles[type], comp.$$.bubbles['*'] ]) {
		if (bubbles) {
			for (const bubble of bubbles) {
				start_bubble(type, bubble, callback);
			}
		}
	}
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {string} type
 * @param {EventListener | null | undefined | false} f 
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [o]
 */
export function add_callback(comp, type, f, o) {
	if (!is_function(f)) {
		return noop;
	}

	const callbacks = (comp.$$.callbacks[type] || (comp.$$.callbacks[type] = []));
	const callback = {f, o};

	if (o && typeof o === 'object' && 'once' in o && o?.once === true) {
		callback.f = function(...args) {
			const r = f.call(this, ...args);
			remove_callback(comp, type, callback);
			return r;
		};
	}

	callbacks.push(callback);
	start_callback(comp, type, callback);
	return () => remove_callback(comp, type, callback);
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {string} type 
 * @param {import ('./private.d.ts').Callback} callback 
 */
function stop_callback(comp, type, callback) {
	for (const bubbles of [ comp.$$.bubbles[type], comp.$$.bubbles['*'] ]) {
		if (bubbles) {
			for (const bubble of bubbles) {
				const dispose = bubble.r.get(callback);
				if (dispose) {
					dispose();
					bubble.r.delete(callback);
				}
			}
		}
	}
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {string} type 
 * @param {import ('./private.d.ts').Callback} callback 
 */
function remove_callback(comp, type, callback) {
	const callbacks = comp.$$.callbacks[type];
	if (callbacks) {
		const index = callbacks.indexOf(callback);
		if (index !== -1) {
			callbacks.splice(index, 1);
			stop_callback(comp, type, callback);
		}
	}
}

/**
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {string} type 
 * @param {import ('./private.d.ts').CallbackFactory} f 
 * @returns {Function}
 */
function add_bubble(comp, type, f) {
	const bubble = {f, r: new Map()};
	const bubbles = (comp.$$.bubbles[type] || (comp.$$.bubbles[type] = []));
	bubbles.push(bubble);

	start_bubbles(comp, bubble);

	return () => {
		const index = bubbles.indexOf(bubble);
		if (index !== -1) bubbles.splice(index, 1);
		for (const dispose of bubble.r.values()) {
			dispose();
		}
	};
}

/**
 * Schedules a callback to run when an handler is added to the component
 * 
 * TODO : Docs
 * 
 * @param {string} type 
 * @param {import ('./private.d.ts').CallbackFactory} fn 
 */

export function onEventListener(type, fn) {
	add_bubble(get_current_component(), type, fn);
}

/**
 * 
 * @param {import ('./Component').SvelteComponent} component 
 * @param {Function} listen_func 
 * @param {EventTarget | import ('./Component').SvelteComponent} node 
 * @param {string} type 
 * @param {string} typeName 
 * @returns {Function}
 */
export function bubble(component, listen_func, node, type, typeName = type) {
	if (type === '*') {
		return add_bubble(component, type, (callback, options, eventType) => {
			/** @type {string | null} */
			let typeToListen = null;
			if (typeName === '*') {
				typeToListen = eventType;
			} else if (typeName.startsWith('*')) {
				const len = typeName.length;
				if (eventType.endsWith(typeName.substring(1))) {
					typeToListen = eventType.substring(0, eventType.length - (len - 1));
				}
			} else if (typeName.endsWith('*')) {
				const len = typeName.length;
				if (eventType.startsWith(typeName.substring(0,len - 1))) {
					typeToListen = eventType.substring(len - 1);
				}
			}
			if (typeToListen) {
				return listen_func(node, typeToListen, callback, options);
			}
		});
	}
	return add_bubble(component, typeName, (callback, options) => {
		return listen_func(node, type, callback, options);
	});
}

/**
 * 
 * @param {import ('./Component').SvelteComponent} comp 
 * @param {string} event 
 * @param {EventListenerOrEventListenerObject | null | undefined | false} handler 
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
 * @param {Function[]} [wrappers]
 * @returns 
 */
export function listen_comp(comp, event, handler, options, wrappers) {
	if (handler) {
		return comp.$on(event, wrap_handler(handler, wrappers), options);
	}
	return noop;
}
