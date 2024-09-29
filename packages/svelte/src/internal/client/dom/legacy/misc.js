import { set, source } from '../../reactivity/sources.js';
import { get } from '../../runtime.js';
import { is_array } from '../../../shared/utils.js';
import { invalid_default_snippet } from '../../../shared/errors.js';

/**
 * Under some circumstances, imports may be reactive in legacy mode. In that case,
 * they should be using `reactive_import` as part of the transformation
 * @param {() => any} fn
 */
export function reactive_import(fn) {
	var s = source(0);

	return function () {
		if (arguments.length === 1) {
			set(s, get(s) + 1);
			return arguments[0];
		} else {
			get(s);
			return fn();
		}
	};
}

/**
 * @this {any}
 * @param {Record<string, unknown>} $$props
 * @param {Event} event
 * @returns {void}
 */
export function bubble_event($$props, event) {
	var events = /** @type {Record<string, Function[] | Function>} */ ($$props.$$events)?.[
		event.type
	];

	var callbacks = is_array(events) ? events.slice() : events == null ? [] : [events];

	for (var fn of callbacks) {
		// Preserve "this" context
		fn.call(this, event);
	}
}

/**
 * Used to simulate `$on` on a component instance when `compatibility.componentApi === 4`
 * @param {Record<string, any>} $$props
 * @param {string} event_name
 * @param {Function} event_callback
 */
export function add_legacy_event_listener($$props, event_name, event_callback) {
	$$props.$$events ||= {};
	$$props.$$events[event_name] ||= [];
	$$props.$$events[event_name].push(event_callback);
}

/**
 * Used to simulate `$set` on a component instance when `compatibility.componentApi === 4`.
 * Needs component accessors so that it can call the setter of the prop. Therefore doesn't
 * work for updating props in `$$props` or `$$restProps`.
 * @this {Record<string, any>}
 * @param {Record<string, any>} $$new_props
 */
export function update_legacy_props($$new_props) {
	for (var key in $$new_props) {
		if (key in this) {
			this[key] = $$new_props[key];
		}
	}
}

/**
 * @param {Record<string, any>} $$props
 */
export function default_slot($$props) {
	var children = $$props.$$slots?.default;
	if (children === true) {
		return $$props.children;
	} else {
		return children;
	}
}


/**
 * @param {Record<string, any>} $$slots
 */
function throw_error_on_slots($$slots) {
	if ($$slots) {
		for (const name of Object.getOwnPropertyNames($$slots)) {
			throw new Error(`Illegal slot "${name}"`);
		}
	}
}

/**
 * @param {Record<string, any>} $$props
 * @param {Record<string, (boolean | string | string[] | {prop: string, args: string[]})>} metadata
 */
function legacy_slots($$props, metadata) {
	for (const name of Object.getOwnPropertyNames($$props.$$slots)) {


		if (name === 'default' && typeof $$props.$$slots[name] !== 'function') {
			continue;
		}


		const meta = metadata[name] ?? false;

		/** @type {string} */
		let prop = name === 'default' ? 'children' : name;
		/** @type {string[] | null} */
		let args = name === 'default' ? [] : null;
		switch (typeof meta) {
		case 'boolean':
			if (meta) {
				args = [];
			}
			break;
		case 'string':
			prop = meta;
			args = [];
			break;
		case 'object':
			if (Array.isArray(meta)) {
				args = meta;
			} else {
				prop = meta.prop;
				args = meta.args;
			}
		}


		if (args == null) {
			// no args : slot is invalid
			throw new Error(`Invalid slot="${name}"`);
		}

		if (prop in $$props) {
			if (name === 'default' && $$props['children'] === invalid_default_snippet) {
				// ok ?
			} else {
				// Conflict between slot and prop
				throw new Error(`Conflict between slot="${name}" and prop '${prop}'`);
			}
		}
		// TODO : warning ???
		
		const slot = $$props.$$slots[name];
		// @ts-ignore
		$$props[prop] = ($$anchor, ...params) => {
			/** @type {Record<string,any>} */
			const slot_props = {};
			args.forEach( (n, i) => {
				const get = params[i];
				if (get) {
					Object.defineProperty(slot_props, n, { get });
				}
			});
			slot($$anchor, slot_props);
		};

	}
	
}

/**
 * @param {Record<string, any>} $$props
 * @param {false | { slots?: any, events?: any}} metadata
 */
export function legacy($$props, metadata) {
	if ($$props.$$slots) {
		if (metadata === false || metadata.slots === false) {
			throw_error_on_slots($$props.$$slots);
		} else if (metadata.slots) {
			legacy_slots($$props, metadata.slots);
		}
	}
}
