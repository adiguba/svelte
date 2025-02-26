/** @import { BlockStatement, Identifier, Statement, Expression, MaybeNamedFunctionDeclaration, Pattern } from 'estree' */
/** @import { AST } from '#compiler' */
/** @import { ComponentContext } from '../types' */
import { attr } from 'svelte/internal/client';
import { BLOCK_CLOSE, BLOCK_OPEN } from '../../../../../internal/server/hydration.js';
import * as b from '../../../../utils/builders.js';
import { extract_identifiers } from '../../../../utils/ast.js';

/**
 * @param {AST.SvelteBoundary} node
 * @param {ComponentContext} context
 */
export function SvelteBoundary(node, context) {
	/** @type {Statement[]} */
	const statements = [];

	/** @type {AST.SnippetBlock | null} */
	let snippet = null;

	/** @type {AST.ConstTag[]} */
	let const_tags = [];

	const nodes = [];

	const payload = b.id('$$payload'); // correct ?

	/** @type {Expression | undefined} */
	let failed;

	// Capture the `failed` explicit snippet prop
	for (const attribute of node.attributes) {
		if (attribute.type === 'Attribute' && attribute.name === 'failed' && attribute.value !== true) {
			const chunk = Array.isArray(attribute.value)
				? /** @type {AST.ExpressionTag} */ (attribute.value[0])
				: attribute.value;
			failed = /** @type {Expression} */ (context.visit(chunk.expression, context.state));
		}
	}

	// Capture the `failed` implicit snippet prop
	for (const child of node.fragment.nodes) {
		if (child.type === 'SnippetBlock' && child.expression.name === 'failed') {
			snippet = child;

			/** @type {Statement[]} */
			const init = [];
			context.visit(snippet, { ...context.state, init });

			if (init.length === 1 && init[0].type === 'FunctionDeclaration') {
				failed = b.arrow(init[0].params, init[0].body);
			} else {
				statements.push(...init);
				failed = b.id('failed');
			}
		} else if (child.type === 'ConstTag') {
			const_tags.push(child);
		} else {
			nodes.push(child);
		}
	}

	if (snippet && has_const_referenced(context, snippet, const_tags)) {
		for (const tag of const_tags) {
			/** @type {Statement[]} */
			const init = [];
			context.visit(tag, { ...context.state, init });
			statements.push(...init);
		}
	} else if (const_tags.length) {
		nodes.unshift(...const_tags);
	}

	const body = b.arrow(
		[b.id('$$payload')],
		/** @type {BlockStatement} */ (context.visit({ ...node.fragment, nodes }))
	);

	statements.push(b.stmt(b.call('$.boundary', payload, body, failed)));

	if (statements.length === 1) {
		context.state.template.push(statements[0]);
	} else {
		context.state.template.push(b.block([...statements]));
	}
}

/**
 *
 * @param {ComponentContext} context
 * @param {AST.SnippetBlock} snippet
 * @param {AST.ConstTag[]} const_tags
 */
function has_const_referenced(context, snippet, const_tags) {
	if (const_tags.length === 0) {
		return false;
	}

	const references = context.state.scopes.get(snippet)?.references;
	if (references == null || references.size === 0) {
		return false;
	}

	const identifiers = new Set();
	for (const tag of const_tags) {
		for (const declaration of tag.declaration.declarations) {
			for (const id of extract_identifiers(declaration.id)) {
				identifiers.add(id.name);
			}
		}
	}

	if (identifiers.size === 0) {
		return false;
	}

	for (const reference of references.keys()) {
		if (identifiers.has(reference)) {
			return true;
		}
	}
	return false;
}
