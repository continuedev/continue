import type {
	NumericLiteral,
	StringLiteral,
	BooleanLiteral,
	Statement,
	Program,
	If,
	For,
	SetStatement,
	MemberExpression,
	CallExpression,
	Identifier,
	BinaryExpression,
	FilterExpression,
	UnaryExpression,
	SliceExpression,
} from "./ast";
import { slice } from "./utils";

export type AnyRuntimeValue =
	| NumericValue
	| StringValue
	| BooleanValue
	| ObjectValue
	| ArrayValue
	| FunctionValue
	| NullValue
	| UndefinedValue;

/**
 * Abstract base class for all Runtime values.
 * Should not be instantiated directly.
 */
abstract class RuntimeValue<T> {
	type = "RuntimeValue";
	value: T;

	/**
	 * A collection of built-in functions for this type.
	 */
	builtins = new Map<string, AnyRuntimeValue>();

	/**
	 * Creates a new RuntimeValue.
	 */
	constructor(value: T = undefined as unknown as T) {
		this.value = value;
	}

	/**
	 * Determines truthiness or falsiness of the runtime value.
	 * This function should be overridden by subclasses if it has custom truthiness criteria.
	 * @returns {BooleanValue} BooleanValue(true) if the value is truthy, BooleanValue(false) otherwise.
	 */
	__bool__(): BooleanValue {
		return new BooleanValue(!!this.value);
	}
}

/**
 * Represents a numeric value at runtime.
 */
export class NumericValue extends RuntimeValue<number> {
	override type = "NumericValue";
}

/**
 * Represents a string value at runtime.
 */
export class StringValue extends RuntimeValue<string> {
	override type = "StringValue";

	override builtins = new Map<string, AnyRuntimeValue>([
		[
			"upper",
			new FunctionValue(() => {
				return new StringValue(this.value.toUpperCase());
			}),
		],
		[
			"lower",
			new FunctionValue(() => {
				return new StringValue(this.value.toLowerCase());
			}),
		],
		[
			"strip",
			new FunctionValue(() => {
				return new StringValue(this.value.trim());
			}),
		],
		["length", new NumericValue(this.value.length)],
	]);
}

/**
 * Represents a boolean value at runtime.
 */
export class BooleanValue extends RuntimeValue<boolean> {
	override type = "BooleanValue";
}

/**
 * Represents an Object value at runtime.
 */
export class ObjectValue extends RuntimeValue<Map<string, AnyRuntimeValue>> {
	override type = "ObjectValue";

	/**
	 * NOTE: necessary to override since all JavaScript arrays are considered truthy,
	 * while only non-empty Python arrays are consider truthy.
	 *
	 * e.g.,
	 *  - JavaScript:  {} && 5 -> 5
	 *  - Python:      {} and 5 -> {}
	 */
	override __bool__(): BooleanValue {
		return new BooleanValue(this.value.size > 0);
	}
}

/**
 * Represents an Array value at runtime.
 */
export class ArrayValue extends RuntimeValue<AnyRuntimeValue[]> {
	override type = "ArrayValue";
	override builtins = new Map<string, AnyRuntimeValue>([["length", new NumericValue(this.value.length)]]);

	/**
	 * NOTE: necessary to override since all JavaScript arrays are considered truthy,
	 * while only non-empty Python arrays are consider truthy.
	 *
	 * e.g.,
	 *  - JavaScript:  [] && 5 -> 5
	 *  - Python:      [] and 5 -> []
	 */
	override __bool__(): BooleanValue {
		return new BooleanValue(this.value.length > 0);
	}
}

/**
 * Represents a Function value at runtime.
 */
export class FunctionValue extends RuntimeValue<(args: AnyRuntimeValue[], scope: Environment) => AnyRuntimeValue> {
	override type = "FunctionValue";
}

/**
 * Represents a Null value at runtime.
 */
export class NullValue extends RuntimeValue<null> {
	override type = "NullValue";
}

/**
 * Represents an Undefined value at runtime.
 */
export class UndefinedValue extends RuntimeValue<undefined> {
	override type = "UndefinedValue";
}

/**
 * Represents the current environment (scope) at runtime.
 */
export class Environment {
	/**
	 * The variables declared in this environment.
	 */
	variables: Map<string, AnyRuntimeValue> = new Map();

	constructor(public parent?: Environment) {}

	/**
	 * Set the value of a variable in the current environment.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
	set(name: string, value: any): AnyRuntimeValue {
		return this.declareVariable(name, convertToRuntimeValues(value));
	}

	private declareVariable(name: string, value: AnyRuntimeValue): AnyRuntimeValue {
		if (this.variables.has(name)) {
			throw new SyntaxError(`Variable already declared: ${name}`);
		}
		this.variables.set(name, value);
		return value;
	}

	// private assignVariable(name: string, value: AnyRuntimeValue): AnyRuntimeValue {
	// 	const env = this.resolve(name);
	// 	env.variables.set(name, value);
	// 	return value;
	// }

	/**
	 * Declare if doesn't exist, assign otherwise.
	 */
	setVariable(name: string, value: AnyRuntimeValue): AnyRuntimeValue {
		let env: Environment | undefined;
		try {
			env = this.resolve(name);
		} catch {
			/* empty */
		}
		(env ?? this).variables.set(name, value);
		return value;
	}

	/**
	 * Resolve the environment in which the variable is declared.
	 * @param {string} name The name of the variable.
	 * @returns {Environment} The environment in which the variable is declared.
	 */
	private resolve(name: string): Environment {
		if (this.variables.has(name)) {
			return this;
		}

		// Traverse scope chain
		if (this.parent) {
			return this.parent.resolve(name);
		}

		throw new Error(`Unknown variable: ${name}`);
	}

	lookupVariable(name: string): AnyRuntimeValue {
		return this.resolve(name).variables.get(name) ?? new NullValue();
	}
}

export class Interpreter {
	global: Environment;

	constructor(env?: Environment) {
		this.global = env ?? new Environment();
	}

	/**
	 * Run the program.
	 */
	run(program: Program): AnyRuntimeValue {
		return this.evaluate(program, this.global);
	}

	/**
	 * Evaulates expressions following the binary operation type.
	 */
	private evaluateBinaryExpression(node: BinaryExpression, environment: Environment): AnyRuntimeValue {
		const left = this.evaluate(node.left, environment);
		const right = this.evaluate(node.right, environment);

		// Arbitrary operands
		switch (node.operator.value) {
			// Equality operators
			case "==":
				return new BooleanValue(left.value == right.value);
			case "!=":
				return new BooleanValue(left.value != right.value);

			// Logical operators
			case "and":
				return left.__bool__().value ? right : left;
			case "or":
				return left.__bool__().value ? left : right;
		}

		if (left instanceof UndefinedValue || right instanceof UndefinedValue) {
			throw new Error("Cannot perform operation on undefined values");
		} else if (left instanceof NullValue || right instanceof NullValue) {
			throw new Error("Cannot perform operation on null values");
		} else if (left instanceof NumericValue && right instanceof NumericValue) {
			// Evaulate pure numeric operations with binary operators.
			switch (node.operator.value) {
				// Arithmetic operators
				case "+":
					return new NumericValue(left.value + right.value);
				case "-":
					return new NumericValue(left.value - right.value);
				case "*":
					return new NumericValue(left.value * right.value);
				case "/":
					return new NumericValue(left.value / right.value);
				case "%":
					return new NumericValue(left.value % right.value);

				// Comparison operators
				case "<":
					return new BooleanValue(left.value < right.value);
				case ">":
					return new BooleanValue(left.value > right.value);
				case ">=":
					return new BooleanValue(left.value >= right.value);
				case "<=":
					return new BooleanValue(left.value <= right.value);
			}
		} else if (right instanceof ArrayValue) {
			const member = right.value.find((x) => x.value === left.value) !== undefined;
			switch (node.operator.value) {
				case "in":
					return new BooleanValue(member);
				case "not in":
					return new BooleanValue(!member);
			}
		}

		if (left instanceof StringValue || right instanceof StringValue) {
			// Support string concatenation as long as at least one operand is a string
			switch (node.operator.value) {
				case "+":
					return new StringValue(left.value.toString() + right.value.toString());
			}
		}

		if (left instanceof StringValue && right instanceof StringValue) {
			switch (node.operator.value) {
				case "in":
					return new BooleanValue(right.value.includes(left.value));
				case "not in":
					return new BooleanValue(!right.value.includes(left.value));
			}
		}

		throw new SyntaxError(`Unknown operator "${node.operator.value}" between ${left.type} and ${right.type}`);
	}

	/**
	 * Evaulates expressions following the filter operation type.
	 */
	private evaluateFilterExpression(node: FilterExpression, environment: Environment): AnyRuntimeValue {
		const operand = this.evaluate(node.operand, environment);

		// For now, we only support the built-in filters
		// TODO: Add support for non-identifier filters
		//   e.g., functions which return filters: {{ numbers | select("odd") }}
		// TODO: Add support for user-defined filters
		//   const filter = environment.lookupVariable(node.filter.value);
		//   if (!(filter instanceof FunctionValue)) {
		//     throw new Error(`Filter must be a function: got ${filter.type}`);
		//   }
		//   return filter.value([operand], environment);

		if (operand instanceof ArrayValue) {
			switch (node.filter.value) {
				case "first":
					return operand.value[0];
				case "last":
					return operand.value[operand.value.length - 1];
				case "length":
					return new NumericValue(operand.value.length);
				case "reverse":
					return new ArrayValue(operand.value.reverse());
				case "sort":
					return new ArrayValue(
						operand.value.sort((a, b) => {
							if (a.type !== b.type) {
								throw new Error(`Cannot compare different types: ${a.type} and ${b.type}`);
							}
							switch (a.type) {
								case "NumericValue":
									return (a as NumericValue).value - (b as NumericValue).value;
								case "StringValue":
									return (a as StringValue).value.localeCompare((b as StringValue).value);
								default:
									throw new Error(`Cannot compare type: ${a.type}`);
							}
						})
					);
				default:
					throw new Error(`Unknown filter: ${node.filter.value}`);
			}
		}

		// TODO add support for StringValue operand
		throw new Error(`Cannot apply filter to type: ${operand.type}`);
	}

	/**
	 * Evaulates expressions following the unary operation type.
	 */
	private evaluateUnaryExpression(node: UnaryExpression, environment: Environment): AnyRuntimeValue {
		const argument = this.evaluate(node.argument, environment);

		switch (node.operator.value) {
			case "not":
				return new BooleanValue(!argument.value);
			default:
				throw new SyntaxError(`Unknown operator: ${node.operator.value}`);
		}
	}

	private evalProgram(program: Program, environment: Environment): AnyRuntimeValue {
		return this.evaluateBlock(program.body, environment);
	}

	private evaluateBlock(statements: Statement[], environment: Environment): StringValue {
		// Jinja templates always evaluate to a String,
		// so we accumulate the result of each statement into a final string

		let result = "";
		for (const statement of statements) {
			const lastEvaluated = this.evaluate(statement, environment);

			if (lastEvaluated.type !== "NullValue") {
				result += lastEvaluated.value;
			}
		}

		// Since `trim_blocks` is enabled, we remove the first newline after the template tag
		result = result.replace(/^\n/, "");

		return new StringValue(result);
	}

	private evaluateIdentifier(node: Identifier, environment: Environment): AnyRuntimeValue {
		return environment.lookupVariable(node.value);
	}

	private evaluateCallExpression(expr: CallExpression, environment: Environment): AnyRuntimeValue {
		const args = expr.args.map((arg) => this.evaluate(arg, environment) as AnyRuntimeValue);
		const fn = this.evaluate(expr.callee, environment);
		if (fn.type !== "FunctionValue") {
			throw new Error(`Cannot call something that is not a function: got ${fn.type}`);
		}
		return (fn as FunctionValue).value(args, environment);
	}

	private evaluateSliceExpression(
		object: AnyRuntimeValue,
		expr: SliceExpression,
		environment: Environment
	): ArrayValue | StringValue {
		if (!(object instanceof ArrayValue || object instanceof StringValue)) {
			throw new Error("Slice object must be an array or string");
		}

		const start = this.evaluate(expr.start, environment);
		const stop = this.evaluate(expr.stop, environment);
		const step = this.evaluate(expr.step, environment);

		// Validate arguments
		if (!(start instanceof NumericValue || start instanceof UndefinedValue)) {
			throw new Error("Slice start must be numeric or undefined");
		}
		if (!(stop instanceof NumericValue || stop instanceof UndefinedValue)) {
			throw new Error("Slice stop must be numeric or undefined");
		}
		if (!(step instanceof NumericValue || step instanceof UndefinedValue)) {
			throw new Error("Slice step must be numeric or undefined");
		}

		if (object instanceof ArrayValue) {
			return new ArrayValue(slice(object.value, start.value, stop.value, step.value));
		} else {
			return new StringValue(slice(Array.from(object.value), start.value, stop.value, step.value).join(""));
		}
	}

	private evaluateMemberExpression(expr: MemberExpression, environment: Environment): AnyRuntimeValue {
		const object = this.evaluate(expr.object, environment);

		let property;
		if (expr.computed) {
			if (expr.property.type === "SliceExpression") {
				return this.evaluateSliceExpression(object, expr.property as SliceExpression, environment);
			} else {
				property = this.evaluate(expr.property, environment);
			}
		} else {
			property = new StringValue((expr.property as Identifier).value);
		}

		let value;
		if (object instanceof ObjectValue) {
			if (!(property instanceof StringValue)) {
				throw new Error(`Cannot access property with non-string: got ${property.type}`);
			}
			value = object.value.get(property.value) ?? object.builtins.get(property.value);
		} else if (object instanceof ArrayValue || object instanceof StringValue) {
			if (property instanceof NumericValue) {
				value = object.value.at(property.value);
				if (object instanceof StringValue) {
					value = new StringValue(object.value.at(property.value));
				}
			} else if (property instanceof StringValue) {
				value = object.builtins.get(property.value);
			} else {
				throw new Error(`Cannot access property with non-string/non-number: got ${property.type}`);
			}
		} else {
			if (!(property instanceof StringValue)) {
				throw new Error(`Cannot access property with non-string: got ${property.type}`);
			}
			value = object.builtins.get(property.value);
		}
		if (!(value instanceof RuntimeValue)) {
			throw new Error(`${object.type} has no property '${property.value}'`);
		}
		return value;
	}

	private evaluateSet(node: SetStatement, environment: Environment): NullValue {
		if (node.assignee.type !== "Identifier") {
			throw new Error(`Invalid LHS inside assignment expression: ${JSON.stringify(node.assignee)}`);
		}

		const variableName = (node.assignee as Identifier).value;
		environment.setVariable(variableName, this.evaluate(node.value, environment));
		return new NullValue();
	}

	private evaluateIf(node: If, environment: Environment): StringValue {
		const test = this.evaluate(node.test, environment);
		return this.evaluateBlock(test.__bool__().value ? node.body : node.alternate, environment);
	}

	private evaluateFor(node: For, environment: Environment): StringValue {
		// Scope for the for loop
		const scope = new Environment(environment);

		const iterable = this.evaluate(node.iterable, scope);
		if (!(iterable instanceof ArrayValue)) {
			throw new Error(`Expected iterable type in for loop: got ${iterable.type}`);
		}

		let result = "";

		for (let i = 0; i < iterable.value.length; ++i) {
			// Update the loop variable
			// TODO: Only create object once, then update value?
			scope.setVariable(
				"loop",
				new ObjectValue(
					new Map(
						(
							[
								["index", new NumericValue(i + 1)],
								["index0", new NumericValue(i)],
								["first", new BooleanValue(i === 0)],
								["last", new BooleanValue(i === iterable.value.length - 1)],
								["length", new NumericValue(iterable.value.length)],
							] as [string, AnyRuntimeValue][]
						).map(([key, value]) => [key, value])
					)
				)
			);

			// For this iteration, set the loop variable to the current element
			scope.setVariable(node.loopvar.value, iterable.value[i]);

			// Evaluate the body of the for loop
			const evaluated = this.evaluateBlock(node.body, scope);
			result += evaluated.value;
		}

		return new StringValue(result);
	}

	evaluate(statement: Statement | undefined, environment: Environment): AnyRuntimeValue {
		if (statement === undefined) return new UndefinedValue();

		switch (statement.type) {
			// Program
			case "Program":
				return this.evalProgram(statement as Program, environment);

			// Statements
			case "Set":
				return this.evaluateSet(statement as SetStatement, environment);
			case "If":
				return this.evaluateIf(statement as If, environment);
			case "For":
				return this.evaluateFor(statement as For, environment);

			// Expressions
			case "NumericLiteral":
				return new NumericValue(Number((statement as NumericLiteral).value));
			case "StringLiteral":
				return new StringValue((statement as StringLiteral).value);
			case "BooleanLiteral":
				return new BooleanValue((statement as BooleanLiteral).value);
			case "Identifier":
				return this.evaluateIdentifier(statement as Identifier, environment);
			case "CallExpression":
				return this.evaluateCallExpression(statement as CallExpression, environment);
			case "MemberExpression":
				return this.evaluateMemberExpression(statement as MemberExpression, environment);

			case "UnaryExpression":
				return this.evaluateUnaryExpression(statement as UnaryExpression, environment);
			case "BinaryExpression":
				return this.evaluateBinaryExpression(statement as BinaryExpression, environment);
			case "FilterExpression":
				return this.evaluateFilterExpression(statement as FilterExpression, environment);

			default:
				throw new SyntaxError(`Unknown node type: ${statement.type}`);
		}
	}
}

/**
 * Helper function to convert JavaScript values to runtime values.
 */
function convertToRuntimeValues(input: unknown): AnyRuntimeValue {
	switch (typeof input) {
		case "number":
			return new NumericValue(input);
		case "string":
			return new StringValue(input);
		case "boolean":
			return new BooleanValue(input);
		case "object":
			if (input === null) {
				return new NullValue();
			} else if (Array.isArray(input)) {
				return new ArrayValue(input.map(convertToRuntimeValues));
			} else {
				return new ObjectValue(
					new Map(Object.entries(input).map(([key, value]) => [key, convertToRuntimeValues(value)]))
				);
			}
		case "function":
			// Wrap the user's function in a runtime function
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			return new FunctionValue((args, _scope) => {
				// NOTE: `_scope` is not used since it's in the global scope
				const result = input(...args.map((x) => x.value)) ?? null; // map undefined -> null
				return convertToRuntimeValues(result);
			});
		default:
			throw new Error(`Cannot convert to runtime value: ${input}`);
	}
}
