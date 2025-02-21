import { escape_html } from '../../escaping.js';
import { clsx as _clsx } from 'clsx';

/**
 * `<div translate={false}>` should be rendered as `<div translate="no">` and _not_
 * `<div translate="false">`, which is equivalent to `<div translate="yes">`. There
 * may be other odd cases that need to be added to this list in future
 * @type {Record<string, Map<any, string>>}
 */
const replacements = {
	translate: new Map([
		[true, 'yes'],
		[false, 'no']
	])
};

/**
 * @template V
 * @param {string} name
 * @param {V} value
 * @param {boolean} [is_boolean]
 * @returns {string}
 */
export function attr(name, value, is_boolean = false) {
	if (value == null || (!value && is_boolean) || (value === '' && name === 'class')) return '';
	const normalized = (name in replacements && replacements[name].get(value)) || value;
	const assignment = is_boolean ? '' : `="${escape_html(normalized, true)}"`;
	return ` ${name}${assignment}`;
}

/**
 * Small wrapper around clsx to preserve Svelte's (weird) handling of falsy values.
 * TODO Svelte 6 revisit this, and likely turn all falsy values into the empty string (what clsx also does)
 * @param  {any} value
 */
export function clsx(value) {
	if (typeof value === 'object') {
		return _clsx(value);
	} else {
		return value ?? '';
	}
}

/**
 * @param {any} clazz
 * @param {string|null} [hash]
 * @param {Record<string,boolean>} [classes]
 * @returns {string|null}
 */
export function to_class(clazz, hash, classes) {
	let class_name = clazz == null ? '' : '' + clazz;
	if (hash) {
		class_name = class_name ? class_name + ' ' + hash : hash;
	}
	if (classes) {
		const white_spaces = ' \t\n\r\f\u00a0\u000b\ufeff';
		for (const key in classes) {
			if (classes[key]) {
				class_name = class_name ? class_name + ' ' + key : key;
			} else if (class_name.length) {
				const len = key.length;
				let start = 0;
				while ((start = class_name.indexOf(key, start)) >= 0) {
					let stop = start + len;
					if (
						white_spaces.indexOf(class_name[start - 1] ?? ' ') >= 0 &&
						white_spaces.indexOf(class_name[stop] ?? ' ') >= 0
					) {
						class_name = (
							class_name.substring(0, start).trim() +
							' ' +
							class_name.substring(stop).trim()
						).trim();
					} else {
						start = stop;
					}
				}
			}
		}
	}
	if (class_name === '') {
		return null;
	}
	return class_name;
}

/**
 * @param {string|null} value
 * @param {Record<string,any>|[Record<string,any>,Record<string,any>]} [styles]
 * @returns {string|null}
 */
export function to_style(value, styles) {
	if (styles) {
		var new_style = '';
		let normal_styles;
		let important_styles;
		if (Array.isArray(styles)) {
			normal_styles = styles[0];
			important_styles = styles[1];
		} else {
			normal_styles = styles;
		}
		if (value) {
			/** @type {boolean | '"' | "'"} */
			var in_str = false;
			var in_apo = 0;
			var in_comment = false;

			var reserved_names = [];
			if (normal_styles) {
				reserved_names.push(...Object.keys(normal_styles));
			}
			if (important_styles) {
				reserved_names.push(...Object.keys(important_styles));
			}

			var start_index = 0;
			var name_index = -1;
			const len = value.length;
			for (var i = 0; i < len; i++) {
				var c = value[i];

				if (in_comment) {
					if (c === '/' && value[i - 1] === '*') {
						in_comment = false;
					}
				} else if (in_str) {
					if (in_str === c) {
						in_str = false;
					}
				} else if (c === '/' && value[i + 1] === '*') {
					in_comment = true;
				} else if (c === '"' || c === "'") {
					in_str = c;
				} else if (c === '(') {
					in_apo++;
				} else if (c === ')') {
					in_apo--;
				} else if (in_apo === 0) {
					if (c === ':' && name_index < 0) {
						name_index = i;
					} else if ((c === ';' && !in_str && in_apo <= 0) || i === len - 1) {
						if (name_index > 0 && name_index < i) {
							let name = value.substring(start_index, name_index).trim();
							if (name.indexOf('/*') > 0) {
								name = name.replaceAll(/\/\*.*?\*\//g, '').trim();
							}
							if (name[0] !== '-' || name[1] !== '-') {
								name = name.toLowerCase();
							}
							if (!reserved_names.includes(name)) {
								if (i === len - 1) {
									i++;
								}
								const property = value.substring(start_index, i).trim();
								new_style += `${property};`;
							}
						}
						start_index = i + 1;
						name_index = -1;
					}
				}
			}
		}

		for (const key in normal_styles) {
			const val = normal_styles[key];
			new_style += `${key}:${val};`;
		}
		for (const key in important_styles) {
			const val = important_styles[key];
			new_style += `${key}:${val} !important;`;
		}
		return new_style;
	} else if (value == null) {
		return null;
	}
	return '' + value;
}
