/** @import { ComponentContextLegacy } from '#client' */
import { run, run_all } from '../../../shared/utils.js';
import { user_pre_effect, user_effect } from '../../reactivity/effects.js';
import { current_component_context, deep_read_state, get, untrack } from '../../runtime.js';

/**
 * Legacy-mode only: Call `onMount` callbacks and set up `beforeUpdate`/`afterUpdate` effects
 */
export function init() {
	const context = /** @type {ComponentContextLegacy} */ (current_component_context);

	const callbacks = context.l.u;
	if (!callbacks) return;

	// beforeUpdate
	if (callbacks.b.length) {
		user_pre_effect(() => {
			observe_all(context);
			run_all(callbacks.b);
		});
	}

	// onMount (must run before afterUpdate)
	user_effect(() => {
		const fns = untrack(() => callbacks.m.map(run));
		return () => {
			for (const fn of fns) {
				if (typeof fn === 'function') {
					fn();
				}
			}
		};
	});

	// afterUpdate
	if (callbacks.a.length) {
		user_effect(() => {
			observe_all(context);
			run_all(callbacks.a);
		});
	}
}

/**
 * Invoke the getter of all signals associated with a component
 * so they can be registered to the effect this function is called in.
 * @param {ComponentContextLegacy} context
 */
function observe_all(context) {
	if (context.l.s) {
		for (const signal of context.l.s) get(signal);
	}

	deep_read_state(context.s);
}

/**
 * Function to mimic the multiple listeners available in svelte 4
 * @deprecated
 * @param {EventListener[]} handlers
 * @returns {EventListener}
 */
export function handlers(...handlers) {
	return function (event) {
		const { stopImmediatePropagation } = event;
		let stopped = false;

		event.stopImmediatePropagation = () => {
			stopped = true;
			stopImmediatePropagation.call(event);
		};

		const errors = [];

		for (const handler of handlers) {
			try {
				// @ts-expect-error `this` is not typed
				handler?.call(this, event);
			} catch (e) {
				errors.push(e);
			}

			if (stopped) {
				break;
			}
		}

		for (let error of errors) {
			queueMicrotask(() => {
				throw error;
			});
		}
	};
}
/**
 * Put the old on:event directive into the Svelte 5's props
 * @deprecated
 * @param {Record<string, any>} props
 * @param {boolean} enabled
 */
export function legacy_events(props, enabled) {
	if (props?.$$events) {
		for (const event_name of Object.getOwnPropertyNames(props.$$events)) {
			const prop_name = 'on' + event_name;
			if (!enabled) {
				throw new Error(`Cannot use on:${event_name} on this component.`);
			}
			const has_prop = prop_name in props;
			if (has_prop) {
				throw new Error(`Cannot use both on:${event_name} and ${prop_name}.`);
			}

			/** @type {Function | Array<EventListener>} */
			let event = props.$$events[event_name];
			if (typeof event === 'function') {
				props[prop_name] = event;
			} else {
				props[prop_name] = handlers(...event);
			}
		}
	}
}
