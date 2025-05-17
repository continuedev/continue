import type { Token, TokenType } from "./lexer";
import { TOKEN_TYPES } from "./lexer";
import type { Statement } from "./ast";
import {
	Program,
	If,
	For,
	SetStatement,
	MemberExpression,
	CallExpression,
	Identifier,
	NumericLiteral,
	StringLiteral,
	BooleanLiteral,
	BinaryExpression,
	FilterExpression,
	UnaryExpression,
	SliceExpression,
} from "./ast";

/**
 * Generate the Abstract Syntax Tree (AST) from a list of tokens.
 * Operator precedence can be found here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
 */
export function parse(tokens: Token[]): Program {
	const program = new Program([]);
	let current = 0;

	function expect(type: string, error: string): Token {
		const prev = tokens[current++];
		if (!prev || prev.type !== type) {
			throw new Error(`Parser Error: ${error}. ${prev.type} !== ${type}.`);
		}
		return prev;
	}

	function parseAny(): Statement {
		switch (tokens[current].type) {
			case TOKEN_TYPES.Text:
				return parseText();
			case TOKEN_TYPES.OpenStatement:
				return parseJinjaStatement();
			case TOKEN_TYPES.OpenExpression:
				return parseJinjaExpression();
			default:
				throw new SyntaxError(`Unexpected token type: ${tokens[current].type}`);
		}
	}

	function not(...types: TokenType[]): boolean {
		return current + types.length <= tokens.length && types.some((type, i) => type !== tokens[current + i].type);
	}

	function is(...types: TokenType[]): boolean {
		return current + types.length <= tokens.length && types.every((type, i) => type === tokens[current + i].type);
	}

	function parseText(): StringLiteral {
		return new StringLiteral(expect(TOKEN_TYPES.Text, "Expected text token").value);
	}

	function parseJinjaStatement(): Statement {
		// Consume {% %} tokens
		expect(TOKEN_TYPES.OpenStatement, "Expected opening statement token");

		let result;
		switch (tokens[current].type) {
			case TOKEN_TYPES.Set:
				++current;
				result = parseSetStatement();
				expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token");
				break;

			case TOKEN_TYPES.If:
				++current;
				result = parseIfStatement();
				expect(TOKEN_TYPES.OpenStatement, "Expected {% token");
				expect(TOKEN_TYPES.EndIf, "Expected endif token");
				expect(TOKEN_TYPES.CloseStatement, "Expected %} token");
				break;

			case TOKEN_TYPES.For:
				++current;
				result = parseForStatement();
				expect(TOKEN_TYPES.OpenStatement, "Expected {% token");
				expect(TOKEN_TYPES.EndFor, "Expected endfor token");
				expect(TOKEN_TYPES.CloseStatement, "Expected %} token");
				break;
			default:
				throw new SyntaxError(`Unknown statement type: ${tokens[current].type}`);
		}

		return result;
	}

	function parseJinjaExpression(): Statement {
		// Consume {{ }} tokens
		expect(TOKEN_TYPES.OpenExpression, "Expected opening expression token");

		const result = parseExpression();

		expect(TOKEN_TYPES.CloseExpression, "Expected closing expression token");
		return result;
	}

	// NOTE: `set` acts as both declaration statement and assignment expression
	function parseSetStatement(): Statement {
		const left = parseExpression();

		if (is(TOKEN_TYPES.Equals)) {
			++current;
			const value = parseSetStatement();

			return new SetStatement(left, value);
		}
		return left;
	}

	function parseIfStatement(): If {
		const test = parseExpression();

		expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token");

		const body: Statement[] = [];
		const alternate: Statement[] = [];

		// Keep parsing if body until we reach the first {% elif %} or {% else %} or {% endif %}
		while (
			!(
				tokens[current]?.type === TOKEN_TYPES.OpenStatement &&
				(tokens[current + 1]?.type === TOKEN_TYPES.ElseIf ||
					tokens[current + 1]?.type === TOKEN_TYPES.Else ||
					tokens[current + 1]?.type === TOKEN_TYPES.EndIf)
			)
		) {
			body.push(parseAny());
		}

		// Alternate branch: Check for {% elif %} or {% else %}
		if (
			tokens[current]?.type === TOKEN_TYPES.OpenStatement &&
			tokens[current + 1]?.type !== TOKEN_TYPES.EndIf // There is some body
		) {
			++current; // eat {% token
			if (is(TOKEN_TYPES.ElseIf)) {
				expect(TOKEN_TYPES.ElseIf, "Expected elseif token");
				alternate.push(parseIfStatement());
			} else {
				// tokens[current]?.type === TokenType.Else
				expect(TOKEN_TYPES.Else, "Expected else token");
				expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token");

				// keep going until we hit {% endif %}
				while (
					!(tokens[current]?.type === TOKEN_TYPES.OpenStatement && tokens[current + 1]?.type === TOKEN_TYPES.EndIf)
				) {
					alternate.push(parseAny());
				}
			}
		}

		return new If(test, body, alternate);
	}

	function parseForStatement(): For {
		// e.g., `message` in `for message in messages`
		const loopVariable = parsePrimaryExpression(); // should be an identifier
		if (!(loopVariable instanceof Identifier)) {
			throw new SyntaxError(`Expected identifier for the loop variable`);
		}

		expect(TOKEN_TYPES.In, "Expected `in` keyword following loop variable");

		// messages in `for message in messages`
		const iterable = parseExpression();

		expect(TOKEN_TYPES.CloseStatement, "Expected closing statement token");

		// Body of for loop
		const body: Statement[] = [];

		// Keep going until we hit {% endfor
		while (not(TOKEN_TYPES.OpenStatement, TOKEN_TYPES.EndFor)) {
			body.push(parseAny());
		}

		return new For(loopVariable, iterable, body);
	}

	function parseExpression(): Statement {
		// Choose parse function with lowest precedence
		return parseLogicalOrExpression();
	}
	function parseLogicalOrExpression(): Statement {
		let left = parseLogicalAndExpression();
		while (is(TOKEN_TYPES.Or)) {
			const operator = tokens[current];
			++current;
			const right = parseLogicalAndExpression();
			left = new BinaryExpression(operator, left, right);
		}
		return left;
	}

	function parseLogicalAndExpression(): Statement {
		let left = parseLogicalNegationExpression();
		while (is(TOKEN_TYPES.And)) {
			const operator = tokens[current];
			++current;
			const right = parseLogicalNegationExpression();
			left = new BinaryExpression(operator, left, right);
		}
		return left;
	}

	function parseLogicalNegationExpression(): Statement {
		let right: UnaryExpression | undefined;

		// Try parse unary operators
		while (is(TOKEN_TYPES.Not)) {
			// not not ...
			const operator = tokens[current];
			++current;
			const arg = parseLogicalNegationExpression(); // not test.x === not (test.x)
			right = new UnaryExpression(operator, arg);
		}

		return right ?? parseComparisonExpression();
	}

	function parseComparisonExpression(): Statement {
		// NOTE: membership has same precedence as comparison
		// e.g., ('a' in 'apple' == 'b' in 'banana') evaluates as ('a' in ('apple' == ('b' in 'banana')))
		let left = parseAdditiveExpression();
		while (is(TOKEN_TYPES.ComparisonBinaryOperator) || is(TOKEN_TYPES.In) || is(TOKEN_TYPES.NotIn)) {
			const operator = tokens[current];
			++current;
			const right = parseAdditiveExpression();
			left = new BinaryExpression(operator, left, right);
		}
		return left;
	}
	function parseAdditiveExpression(): Statement {
		let left = parseMultiplicativeExpression();
		while (is(TOKEN_TYPES.AdditiveBinaryOperator)) {
			const operator = tokens[current];
			++current;
			const right = parseMultiplicativeExpression();
			left = new BinaryExpression(operator, left, right);
		}
		return left;
	}

	function parseCallMemberExpression(): Statement {
		// Handle member expressions recursively

		const member = parseMemberExpression(); // foo.x

		if (is(TOKEN_TYPES.OpenParen)) {
			// foo.x()
			return parseCallExpression(member);
		}
		return member;
	}

	function parseCallExpression(callee: Statement): CallExpression {
		let callExpression = new CallExpression(callee, parseArgs());

		if (is(TOKEN_TYPES.OpenParen)) {
			// foo.x()()
			callExpression = parseCallExpression(callExpression);
		}

		return callExpression;
	}

	function parseArgs(): Statement[] {
		// add (x + 5, foo())
		expect(TOKEN_TYPES.OpenParen, "Expected opening parenthesis for arguments list");

		const args = is(TOKEN_TYPES.CloseParen) ? [] : parseArgumentsList();

		expect(TOKEN_TYPES.CloseParen, "Expected closing parenthesis for arguments list");
		return args;
	}
	function parseArgumentsList(): Statement[] {
		// comma-separated arguments list
		const args = [parseExpression()]; // Update when we allow assignment expressions

		while (is(TOKEN_TYPES.Comma)) {
			++current; // consume comma
			args.push(parseExpression());
		}
		return args;
	}
	function parseMemberExpressionArgumentsList(): Statement {
		// NOTE: This also handles slice expressions colon-separated arguments list
		// e.g., ['test'], [0], [:2], [1:], [1:2], [1:2:3]

		const slices: (Statement | undefined)[] = [];
		let isSlice = false;
		while (!is(TOKEN_TYPES.CloseSquareBracket)) {
			if (is(TOKEN_TYPES.Colon)) {
				// A case where a default is used
				// e.g., [:2] will be parsed as [undefined, 2]
				slices.push(undefined);
				++current; // consume colon
				isSlice = true;
			} else {
				slices.push(parseExpression());
				if (is(TOKEN_TYPES.Colon)) {
					++current; // consume colon after expression, if it exists
					isSlice = true;
				}
			}
		}
		if (slices.length === 0) {
			// []
			throw new SyntaxError(`Expected at least one argument for member/slice expression`);
		}

		if (isSlice) {
			if (slices.length > 3) {
				throw new SyntaxError(`Expected 0-3 arguments for slice expression`);
			}
			return new SliceExpression(...slices);
		}

		return slices[0] as Statement; // normal member expression
	}

	function parseMemberExpression(): Statement {
		let object = parsePrimaryExpression();

		while (is(TOKEN_TYPES.Dot) || is(TOKEN_TYPES.OpenSquareBracket)) {
			const operator = tokens[current]; // . or [
			++current;
			let property: Statement;
			const computed = operator.type !== TOKEN_TYPES.Dot;
			if (computed) {
				// computed (i.e., bracket notation: obj[expr])
				property = parseMemberExpressionArgumentsList();
				expect(TOKEN_TYPES.CloseSquareBracket, "Expected closing square bracket");
			} else {
				// non-computed (i.e., dot notation: obj.expr)
				property = parsePrimaryExpression(); // should be an identifier
				if (property.type !== "Identifier") {
					throw new SyntaxError(`Expected identifier following dot operator`);
				}
			}
			object = new MemberExpression(object, property, computed);
		}
		return object;
	}

	function parseMultiplicativeExpression(): Statement {
		let left = parseFilterExpression();

		while (is(TOKEN_TYPES.MultiplicativeBinaryOperator)) {
			const operator = tokens[current];
			++current;
			const right = parseFilterExpression();
			left = new BinaryExpression(operator, left, right);
		}
		return left;
	}

	function parseFilterExpression(): Statement {
		let operand = parseCallMemberExpression();

		while (is(TOKEN_TYPES.Pipe)) {
			// Support chaining filters
			++current; // consume pipe
			const filter = parsePrimaryExpression(); // should be an identifier
			if (!(filter instanceof Identifier)) {
				throw new SyntaxError(`Expected identifier for the filter`);
			}
			operand = new FilterExpression(operand, filter);
		}
		return operand;
	}

	function parsePrimaryExpression(): Statement {
		// Primary expression: number, string, identifier, function call, parenthesized expression
		const token = tokens[current];
		switch (token.type) {
			case TOKEN_TYPES.NumericLiteral:
				++current;
				return new NumericLiteral(Number(token.value));
			case TOKEN_TYPES.StringLiteral:
				++current;
				return new StringLiteral(token.value);
			case TOKEN_TYPES.BooleanLiteral:
				++current;
				return new BooleanLiteral(token.value === "true");
			case TOKEN_TYPES.Identifier:
				++current;
				return new Identifier(token.value);
			case TOKEN_TYPES.OpenParen: {
				++current; // consume opening parenthesis
				const expression = parseExpression();
				if (tokens[current].type !== TOKEN_TYPES.CloseParen) {
					throw new SyntaxError("Expected closing parenthesis");
				}
				++current; // consume closing parenthesis
				return expression;
			}
			default:
				throw new SyntaxError(`Unexpected token: ${token.type}`);
		}
	}

	while (current < tokens.length) {
		program.body.push(parseAny());
	}

	return program;
}
