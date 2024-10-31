/** @import { AST } from '#compiler' */
/** @import { Context } from '../types' */
import * as e from '../../../errors.js';
import { get_attribute_chunks } from '../../../utils/ast.js';
import { mark_subtree_dynamic } from './shared/fragment.js';

/**
 * @param {AST.StyleDirective} node
 * @param {Context} context
 */
export function StyleDirective(node, context) {
	if (node.name === 'display' && node.modifiers.length === 1 && node.modifiers[0] === 'if') {
		const parent = context.path.at(-1);
		if (parent?.type === 'SvelteElement' || parent?.type === 'RegularElement') {
			context.state.analysis.style_display_if = true;
		}
	} else if (
		node.modifiers.length > 1 ||
		(node.modifiers.length && node.modifiers[0] !== 'important')
	) {
		e.style_directive_invalid_modifier(node);
	}

	mark_subtree_dynamic(context.path);

	if (node.value === true) {
		// get the binding for node.name and change the binding to state
		let binding = context.state.scope.get(node.name);

		if (binding) {
			if (binding.kind !== 'normal') {
				node.metadata.expression.has_state = true;
			}
		}
	} else {
		context.next();

		for (const chunk of get_attribute_chunks(node.value)) {
			if (chunk.type !== 'ExpressionTag') continue;

			node.metadata.expression.has_state ||= chunk.metadata.expression.has_state;
			node.metadata.expression.has_call ||= chunk.metadata.expression.has_call;
		}
	}
}
