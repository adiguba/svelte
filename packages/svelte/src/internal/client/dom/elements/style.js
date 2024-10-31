/**
 * @param {HTMLElement} dom
 * @param {string} key
 * @param {string|null} value
 * @param {boolean} [important]
 */
export function set_style(dom, key, value, important) {
	// @ts-expect-error
	var styles = (dom.__styles ??= {});

	if (styles[key] === value) {
		return;
	}

	styles[key] = value;

	if (value == null) {
		dom.style.removeProperty(key);
	} else {
		dom.style.setProperty(key, value, important ? 'important' : '');
	}
}

/**
 * @param {HTMLElement} dom
 * @param {boolean} value
 */
export function set_display(dom, value) {
	const visible = !!value;

	// @ts-expect-error
	var styles = (dom.__styles ??= {});

	if (styles.display === visible) {
		return;
	}

	styles.display = visible;

	/** @type {import('#client').TransitionManager[] | undefined} */
	// @ts-expect-error
	const tm = dom.__tm;
	if (tm) {
		dom.style.removeProperty('display');
		if (visible) {
			for (const transition of tm) {
				transition.in();
			}
		} else {
			var remaining = tm.length;
			var check = () => {
				if (--remaining == 0) {
					// cleanup
					for (var transition of tm) {
						transition.stop();
					}
					dom.style.setProperty('display', 'none', 'important');
				}
			};
			for (var transition of tm) {
				transition.out(check);
			}
		}
	} else {
		if (visible) {
			dom.style.removeProperty('display');
		} else {
			dom.style.setProperty('display', 'none', 'important');
		}
	}
}
