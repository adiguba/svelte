import { set, source } from '../../reactivity/sources.js';
import { get } from '../../runtime.js';
import { is_array } from '../../../shared/utils.js';
import { handlers } from './event-modifiers.js';

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
			if (name !== 'default') {
				throw new Error(`Illegal slot "${name}"`);
			}
		}
	}
}

/**
 * @param {Record<string, any>} $$events
 */
function throw_error_on_events($$events) {
	if ($$events) {
		for (const name of Object.getOwnPropertyNames($$events)) {
			throw new Error(`Illegal directive "on:${name}"`);
		}
	}
}

/**
 * @param {Record<string, any>} $$props
 * @param {Record<string, (boolean | string | string[] | {prop: string, args: string[]})>} metadata
 */
function legacy_slots($$props, metadata) {
	for (const name of Object.getOwnPropertyNames($$props.$$slots)) {

		const is_default = name === 'default';

		if (is_default && $$props.$$slots[name] === true) {
			continue;
		}

		const meta = metadata[name] ?? false;

		/** @type {string} */
		let prop = is_default ? 'children' : name;
		/** @type {string[] | null} */
		let args = null;

		if (meta === true) {
			args = [];
		} else if (meta !== false) {
			switch (typeof meta) {
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
		}

		if (args == null) {
			// no args : slot is invalid
			throw new Error(`Invalid slot="${name}"`);
		}

		if (!is_default && prop in $$props) {
			// Conflict between slot and prop
			throw new Error(`Conflict between slot="${name}" and prop '${prop}'`);
		}
		// TODO : warning ???
		
		const slot = $$props.$$slots[name];

		if (args.length === 0) {
			// @ts-ignore
			$$props[prop] = ($$anchor) => slot($$anchor, {});
		} else {
			// @ts-ignore
			$$props[prop] = ($$anchor, ...params) => {
				/** @type {Record<string,any>} */
				const slot_props = {};
				args.forEach( (name, index) => {
					if (name) {
						const get = params[index];
						if (name && get) {
							Object.defineProperty(slot_props, name, { get });
						}
					}
				});
				slot($$anchor, slot_props);
			};
		}
	}
}

/**
 * Return the translated name of the event
 * @param {boolean | string} meta 
 * @return {string | null}
 */
function get_event_prop_name(meta) {
	let prop = null;
	if (meta === true) {
		prop = 'on' + name;
	} else if (meta !== false) {
		switch (typeof meta) {
		case 'string':
			prop = meta;
			break;
		}
	}
	return prop;
}

/**
 * @param {Record<string, any>} $$props
 * @param {Record<string, (boolean | string)>} metadata
 */
function legacy_events($$props, metadata) {	
	for (const name of Object.getOwnPropertyNames($$props.$$events)) {
		const meta = metadata[name] ?? false;
		const prop = get_event_prop_name(meta);

		if (prop == null) {
			// event is invalid
			throw new Error(`Invalid directive "on:${name}"`);
		}

		if (prop in $$props) {
			// Conflict between slot and prop
			throw new Error(`Conflict between directive "on:${name}" and prop '${prop}'`);
		}

		const fn = $$props.$$events[name];
		if (typeof fn === 'function') {
			$$props[prop] = fn;
		} else {
			$$props[prop] = handlers(...fn);
		}
	}
}

/**
 * @param {Record<string, any>} $$props
 * @param {false | { slots?: any, events?: any}} metadata
 */
export function legacy($$props, metadata) {
	if (metadata === false) {
		throw_error_on_slots($$props.$$slots);
		throw_error_on_events($$props.$$events);
	} else {
		if ($$props.$$slots) {
			if (metadata.slots === false) {
				throw_error_on_slots($$props.$$slots);
			} else if (metadata.slots) {
				legacy_slots($$props, metadata.slots);
			}
		}

		if ($$props.$$events) {
			if (metadata.events === false) {
				throw_error_on_events($$props.$$events);
			} else if (metadata.events) {
				legacy_events($$props, metadata.events);
			}
		}
	}

	let event_names = null;
	if (metadata === false || metadata.events === false) {
		event_names = {};
	} else {
		event_names = metadata.events;
	}

	// Event's names are stored in $$events, for createEventDispatcher()
	if (event_names != null) {
		$$props.$$events = $$props.$$events || {};
		$$props.$$events.$$event_names = event_names;
	}
}
