/** @import { BlockStatement } from 'estree' */
/** @import { AST } from '#compiler' */
/** @import { ComponentContext } from '../types.js' */
import * as b from '../../../../utils/builders.js';

/**
 * @param {AST.SnippetBlock} node
 * @param {ComponentContext} context
 */
export function SnippetBlock(node, context) {
	let fn;
	if (node.test) {
		const arrow = b.arrow(
			[b.id('$$payload'), ...node.parameters],
			/** @type {BlockStatement} */ (context.visit(node.body))
		);

		fn = b.const(node.expression, b.conditional(node.test, arrow, b.id('undefined')));
	} else {
		fn = b.function_declaration(
			node.expression,
			[b.id('$$payload'), ...node.parameters],
			/** @type {BlockStatement} */ (context.visit(node.body))
		);
	}

	// @ts-expect-error - TODO remove this hack once $$render_inner for legacy bindings is gone
	fn.___snippet = true;

	// TODO hoist where possible
	context.state.init.push(fn);
}
