import type { Token } from "./lexer";

/**
 * Statements do not result in a value at runtime. They contain one or more expressions internally.
 */
export class Statement {
	type = "Statement";
}

/**
 * Defines a block which contains many statements. Each chat template corresponds to one Program.
 */
export class Program extends Statement {
	override type = "Program";

	constructor(public body: Statement[]) {
		super();
	}
}

export class If extends Statement {
	override type = "If";

	constructor(
		public test: Expression,
		public body: Statement[],
		public alternate: Statement[]
	) {
		super();
	}
}

export class For extends Statement {
	override type = "For";

	constructor(
		public loopvar: Identifier,
		public iterable: Expression,
		public body: Statement[]
	) {
		super();
	}
}

export class SetStatement extends Statement {
	override type = "Set";
	constructor(
		public assignee: Expression,
		public value: Expression
	) {
		super();
	}
}

/**
 * Expressions will result in a value at runtime (unlike statements).
 */
export class Expression extends Statement {
	override type = "Expression";
}

export class MemberExpression extends Expression {
	override type = "MemberExpression";

	constructor(
		public object: Expression,
		public property: Expression,
		public computed: boolean
	) {
		super();
	}
}

export class CallExpression extends Expression {
	override type = "CallExpression";

	constructor(
		public callee: Expression,
		public args: Expression[]
	) {
		super();
	}
}

/**
 * Represents a user-defined variable or symbol in the template.
 */
export class Identifier extends Expression {
	override type = "Identifier";

	/**
	 * @param {string} value The name of the identifier
	 */
	constructor(public value: string) {
		super();
	}
}

/**
 * Abstract base class for all Literal expressions.
 * Should not be instantiated directly.
 */
abstract class Literal<T> extends Expression {
	override type = "Literal";

	constructor(public value: T) {
		super();
	}
}

/**
 * Represents a numeric constant in the template.
 */
export class NumericLiteral extends Literal<number> {
	override type = "NumericLiteral";
}

/**
 * Represents a text constant in the template.
 */
export class StringLiteral extends Literal<string> {
	override type = "StringLiteral";

	constructor(value: string) {
		super(value);
	}
}

/**
 * Represents a boolean constant in the template.
 */
export class BooleanLiteral extends Literal<boolean> {
	override type = "BooleanLiteral";
}

/**
 * An operation with two sides, separated by an operator.
 * Note: Either side can be a Complex Expression, with order
 * of operations being determined by the operator.
 */
export class BinaryExpression extends Expression {
	override type = "BinaryExpression";

	constructor(
		public operator: Token,
		public left: Expression,
		public right: Expression
	) {
		super();
	}
}

/**
 * An operation with two sides, separated by the | operator.
 * Operator precedence: https://github.com/pallets/jinja/issues/379#issuecomment-168076202
 */
export class FilterExpression extends Expression {
	override type = "FilterExpression";

	constructor(
		public operand: Expression,
		public filter: Identifier // TODO: Add support for non-identifier filters
	) {
		super();
	}
}

/**
 * An operation with one side (operator on the left).
 */
export class UnaryExpression extends Expression {
	override type = "UnaryExpression";

	constructor(
		public operator: Token,
		public argument: Expression
	) {
		super();
	}
}

/**
 * Logical negation of an expression.
 */
export class LogicalNegationExpression extends Expression {
	override type = "LogicalNegationExpression";

	constructor(public argument: Expression) {
		super();
	}
}

export class SliceExpression extends Expression {
	override type = "SliceExpression";

	constructor(
		public start: Expression | undefined = undefined,
		public stop: Expression | undefined = undefined,
		public step: Expression | undefined = undefined
	) {
		super();
	}
}
