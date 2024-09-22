import * as e from '../errors.js';
import * as w from '../warnings.js';
import { current_component_context } from '../runtime.js';
import { FILENAME } from '../../../constants.js';
import { get_component } from './ownership.js';

/** @param {Function & { [FILENAME]: string }} target */
export function check_target(target) {
	if (target) {
		e.component_api_invalid_new(target[FILENAME] ?? 'a component', target.name);
	}
}

/**
 * Show warning when a Svelte 5 runes component receive the old on:event directive
 * @param {{$$events?: Record<string, unknown>}?} props
 * @param {string} component_name
 */
export function check_events(props, component_name) {
	if (props?.$$events) {
		for (const event_name of Object.getOwnPropertyNames(props.$$events)) {
			w.on_directive_on_svelte5_component(event_name, component_name);
		}
	}
}

export function legacy_api() {
	const component = current_component_context?.function;

	/** @param {string} method */
	function error(method) {
		// @ts-expect-error
		const parent = get_component()?.[FILENAME] ?? 'Something';
		e.component_api_changed(parent, method, component[FILENAME]);
	}

	return {
		$destroy: () => error('$destroy()'),
		$on: () => error('$on(...)'),
		$set: () => error('$set(...)')
	};
}
