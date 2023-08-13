import { x, p } from 'code-red';

const TRUE = x`true`;
const FALSE = x`false`;

export default class EventHandlerWrapper {
	/** @type {import('../../../nodes/EventHandler.js').default} */
	node;

	/** @type {import('../shared/Wrapper.js').default} */
	parent;

	/**
	 * @param {import('../../../nodes/EventHandler.js').default} node
	 * @param {import('../shared/Wrapper.js').default} parent
	 */
	constructor(node, parent) {
		this.node = node;
		this.parent = parent;
	}

	/** @param {import('../../Block.js').default} block */
	get_snippet(block) {
		return this.node.expression.manipulate(block);
	}

	/**
	 * @param {import('../../Block.js').default} block
	 * @param {string | import('estree').Expression} target
	 * @param {boolean} is_comp
	 */
	render(block, target, is_comp = false) {
		const listen = is_comp ? '@listen_comp' : '@listen';
		if (!this.node.expression) {
			const self = this.parent.renderer.add_to_context('$$self');
			const selfvar = block.renderer.reference(self.name);
			const aliasName = this.node.aliasName ? `"${this.node.aliasName}"` : null;
	
			block.event_listeners.push(x`@bubble(${selfvar}, ${listen}, ${target}, "${this.node.name}", ${aliasName})`);
			return;
		}
	
		const snippet = this.get_snippet(block);

		const wrappers = [];
		if (this.node.modifiers.has('trusted')) wrappers.push(x`@trusted`);
		if (this.node.modifiers.has('self')) wrappers.push(x`@self`);
		if (this.node.modifiers.has('stopImmediatePropagation')) wrappers.push(x`@stop_immediate_propagation`);
		if (this.node.modifiers.has('stopPropagation')) wrappers.push(x`@stop_propagation`);
		if (this.node.modifiers.has('preventDefault')) wrappers.push(x`@prevent_default`);
		// TODO : once() on component ????

		const args = [];

		const opts = ['nonpassive', 'passive', 'once', 'capture'].filter(mod => this.node.modifiers.has(mod));
		if (opts.length) {
			if (opts.length === 1 && opts[0] === 'capture') {
				args.push(TRUE);
			} else {
				args.push(x`{ ${ opts.map(opt =>
					opt === 'nonpassive'
						? p`passive: false`
						: p`${opt}: true`
				) } }`);
			}
		} else if (wrappers.length) {
			args.push(FALSE);
		}
		if (wrappers.length) {
			args.push(x`[${wrappers}]`);
		}

		if (this.node.reassigned) {
			const index = block.event_listeners.length;
			const condition = block.renderer.dirty(this.node.expression.dynamic_dependencies());

			block.event_updaters.push({condition, index});
			block.event_listeners.push(
				x`@listen_and_update( () => (${snippet}), (h) => ${listen}(${target}, "${this.node.name}", h, ${args}))`
			);
		} else {
			block.event_listeners.push(
				x`${listen}(${target}, "${this.node.name}", ${snippet}, ${args})`
			);
		}
	}
}
