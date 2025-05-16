/**
 * Represents tokens that our language understands in parsing.
 */
export const TOKEN_TYPES = Object.freeze({
	Text: "Text", // The text between Jinja statements or expressions

	NumericLiteral: "NumericLiteral", // e.g., 123
	BooleanLiteral: "BooleanLiteral", // true or false
	StringLiteral: "StringLiteral", // 'string'
	Identifier: "Identifier", // Variables, functions, etc.
	Equals: "Equals", // =
	OpenParen: "OpenParen", // (
	CloseParen: "CloseParen", // )
	OpenStatement: "OpenStatement", // {%
	CloseStatement: "CloseStatement", // %}
	OpenExpression: "OpenExpression", // {{
	CloseExpression: "CloseExpression", // }}
	OpenSquareBracket: "OpenSquareBracket", // [
	CloseSquareBracket: "CloseSquareBracket", // ]
	Comma: "Comma", // ,
	Dot: "Dot", // .
	Colon: "Colon", // :
	Pipe: "Pipe", // |

	CallOperator: "CallOperator", // ()
	AdditiveBinaryOperator: "AdditiveBinaryOperator", // + -
	MultiplicativeBinaryOperator: "MultiplicativeBinaryOperator", // * / %
	ComparisonBinaryOperator: "ComparisonBinaryOperator", // < > <= >= == !=
	UnaryOperator: "UnaryOperator", // ! - +

	// Keywords
	Set: "Set",
	If: "If",
	For: "For",
	In: "In",
	NotIn: "NotIn",
	Else: "Else",
	EndIf: "EndIf",
	ElseIf: "ElseIf",
	EndFor: "EndFor",
	And: "And",
	Or: "Or",
	Not: "UnaryOperator",
});

export type TokenType = keyof typeof TOKEN_TYPES;

/**
 * Constant lookup for keywords and known identifiers + symbols.
 */
const KEYWORDS = Object.freeze({
	set: TOKEN_TYPES.Set,
	for: TOKEN_TYPES.For,
	in: TOKEN_TYPES.In,
	if: TOKEN_TYPES.If,
	else: TOKEN_TYPES.Else,
	endif: TOKEN_TYPES.EndIf,
	elif: TOKEN_TYPES.ElseIf,
	endfor: TOKEN_TYPES.EndFor,
	and: TOKEN_TYPES.And,
	or: TOKEN_TYPES.Or,
	not: TOKEN_TYPES.Not,
	"not in": TOKEN_TYPES.NotIn,

	// Literals
	true: TOKEN_TYPES.BooleanLiteral,
	false: TOKEN_TYPES.BooleanLiteral,
});

/**
 * Represents a single token in the template.
 */
export class Token {
	/**
	 * Constructs a new Token.
	 * @param {string} value The raw value as seen inside the source code.
	 * @param {TokenType} type The type of token.
	 */
	constructor(
		public value: string,
		public type: TokenType
	) {}
}

function isWord(char: string): boolean {
	return /\w/.test(char);
}

function isInteger(char: string): boolean {
	return /[0-9]/.test(char);
}

/**
 * A data structure which contains a list of rules to test
 */
const ORDERED_MAPPING_TABLE: [string, TokenType][] = [
	// Control sequences
	["{%", TOKEN_TYPES.OpenStatement],
	["%}", TOKEN_TYPES.CloseStatement],
	["{{", TOKEN_TYPES.OpenExpression],
	["}}", TOKEN_TYPES.CloseExpression],
	// Single character tokens
	["(", TOKEN_TYPES.OpenParen],
	[")", TOKEN_TYPES.CloseParen],
	["[", TOKEN_TYPES.OpenSquareBracket],
	["]", TOKEN_TYPES.CloseSquareBracket],
	[",", TOKEN_TYPES.Comma],
	[".", TOKEN_TYPES.Dot],
	[":", TOKEN_TYPES.Colon],
	["|", TOKEN_TYPES.Pipe],
	// Comparison operators
	["<=", TOKEN_TYPES.ComparisonBinaryOperator],
	[">=", TOKEN_TYPES.ComparisonBinaryOperator],
	["==", TOKEN_TYPES.ComparisonBinaryOperator],
	["!=", TOKEN_TYPES.ComparisonBinaryOperator],
	["<", TOKEN_TYPES.ComparisonBinaryOperator],
	[">", TOKEN_TYPES.ComparisonBinaryOperator],
	// Arithmetic operators
	["+", TOKEN_TYPES.AdditiveBinaryOperator],
	["-", TOKEN_TYPES.AdditiveBinaryOperator],
	["*", TOKEN_TYPES.MultiplicativeBinaryOperator],
	["/", TOKEN_TYPES.MultiplicativeBinaryOperator],
	["%", TOKEN_TYPES.MultiplicativeBinaryOperator],
	// Assignment operator
	["=", TOKEN_TYPES.Equals],
];

const ESCAPE_CHARACTERS = new Map([
	["n", "\n"], // New line
	["t", "\t"], // Horizontal tab
	["r", "\r"], // Carriage return
	["b", "\b"], // Backspace
	["f", "\f"], // Form feed
	["v", "\v"], // Vertical tab
	["'", "'"], // Single quote
	['"', '"'], // Double quote
	["\\", "\\"], // Backslash
]);

/**
 * Generate a list of tokens from a source string.
 */
export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	const src: string = source;

	let cursorPosition = 0;

	const consumeWhile = (predicate: (char: string) => boolean): string => {
		let str = "";
		while (predicate(src[cursorPosition])) {
			// Check for escaped characters
			if (src[cursorPosition] === "\\") {
				// Consume the backslash
				++cursorPosition;
				// Check for end of input
				if (cursorPosition >= src.length) throw new SyntaxError("Unexpected end of input");

				// Add the escaped character
				const escaped = src[cursorPosition++];
				const unescaped = ESCAPE_CHARACTERS.get(escaped);
				if (unescaped === undefined) {
					throw new SyntaxError(`Unexpected escaped character: ${escaped}`);
				}
				str += unescaped;
				continue;
			}

			str += src[cursorPosition++];
			if (cursorPosition >= src.length) throw new SyntaxError("Unexpected end of input");
		}
		return str;
	};

	// Build each token until end of input
	main: while (cursorPosition < src.length) {
		// First, consume all text that is outside of a Jinja statement or expression
		const lastTokenType = tokens.at(-1)?.type;
		if (
			lastTokenType === undefined ||
			lastTokenType === TOKEN_TYPES.CloseStatement ||
			lastTokenType === TOKEN_TYPES.CloseExpression
		) {
			let text = "";
			while (
				cursorPosition < src.length &&
				// Keep going until we hit the next Jinja statement or expression
				!(src[cursorPosition] === "{" && (src[cursorPosition + 1] === "%" || src[cursorPosition + 1] === "{"))
			) {
				// Consume text
				text += src[cursorPosition++];
			}

			// There is some text to add
			if (text.length > 0) {
				tokens.push(new Token(text, TOKEN_TYPES.Text));
				continue;
			}
		}

		// Consume (and ignore) all whitespace inside Jinja statements or expressions
		consumeWhile((char) => /\s/.test(char));

		// Handle multi-character tokens
		const char = src[cursorPosition];

		// Check for unary operators
		if (char === "-" || char === "+") {
			const lastTokenType = tokens.at(-1)?.type;
			if (lastTokenType === TOKEN_TYPES.Text || lastTokenType === undefined) {
				throw new SyntaxError(`Unexpected character: ${char}`);
			}
			switch (lastTokenType) {
				case TOKEN_TYPES.Identifier:
				case TOKEN_TYPES.NumericLiteral:
				case TOKEN_TYPES.BooleanLiteral:
				case TOKEN_TYPES.StringLiteral:
				case TOKEN_TYPES.CloseParen:
				case TOKEN_TYPES.CloseSquareBracket:
					// Part of a binary operator
					// a - 1, 1 - 1, true - 1, "apple" - 1, (1) - 1, a[1] - 1
					// Continue parsing normally
					break;

				default: {
					// Is part of a unary operator
					// (-1), [-1], (1 + -1), not -1, -apple
					++cursorPosition; // consume the unary operator

					// Check for numbers following the unary operator
					const num = consumeWhile(isInteger);
					tokens.push(
						new Token(`${char}${num}`, num.length > 0 ? TOKEN_TYPES.NumericLiteral : TOKEN_TYPES.UnaryOperator)
					);
					continue;
				}
			}
		}

		// Try to match one of the tokens in the mapping table
		for (const [char, token] of ORDERED_MAPPING_TABLE) {
			const slice = src.slice(cursorPosition, cursorPosition + char.length);
			if (slice === char) {
				tokens.push(new Token(char, token));
				cursorPosition += char.length;
				continue main;
			}
		}

		if (char === "'") {
			++cursorPosition; // Skip the opening quote
			const str = consumeWhile((char) => char !== "'");
			tokens.push(new Token(str, TOKEN_TYPES.StringLiteral));
			++cursorPosition; // Skip the closing quote
			continue;
		}

		if (isInteger(char)) {
			const num = consumeWhile(isInteger);
			tokens.push(new Token(num, TOKEN_TYPES.NumericLiteral));
			continue;
		}
		if (isWord(char)) {
			const word = consumeWhile(isWord);

			// Check for special/reserved keywords
			// NOTE: We use Object.hasOwn() to avoid matching `.toString()` and other Object methods
			const type = Object.hasOwn(KEYWORDS, word) ? KEYWORDS[word as keyof typeof KEYWORDS] : TOKEN_TYPES.Identifier;

			// Special case of not in:
			// If the previous token was a "not", and this token is "in"
			// then we want to combine them into a single token
			if (type === TOKEN_TYPES.In && tokens.at(-1)?.type === TOKEN_TYPES.Not) {
				tokens.pop();
				tokens.push(new Token("not in", TOKEN_TYPES.NotIn));
			} else {
				tokens.push(new Token(word, type));
			}

			continue;
		}

		throw new SyntaxError(`Unexpected character: ${char}`);
	}
	return tokens;
}
