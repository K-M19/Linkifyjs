import {inherits} from './linkify/utils/class';
import * as options from './linkify/utils/options';
import * as scanner from './linkify/core/scanner';
import * as parser from './linkify/core/parser';

if (!Array.isArray) {
	Array.isArray = function(arg) {
		return Object.prototype.toString.call(arg) === '[object Array]';
	};
}

/**
	Converts a string into tokens that represent linkable and non-linkable bits
	@method tokenize
	@param {String} str
	@return {Array} tokens
*/
let tokenize = function (str) {
	return parser.run(scanner.run(str));
};

/**
	Returns a list of linkable items in the given string.
*/
let find = function (str, type = null) {
	let tokens = tokenize(str);
	let filtered = [];

	for (var i = 0; i < tokens.length; i++) {
		let token = tokens[i];
		if (token.isLink && (!type || token.type === type)) {
			filtered.push(token.toObject());
		}
	}

	return filtered;
};

/**
	Is the given string valid linkable text of some sort
	Note that this does not trim the text for you.

	Optionally pass in a second `type` param, which is the type of link to test
	for.

	For example,

		test(str, 'email');

	Will return `true` if str is a valid email.
*/
let test = function (str, type = null) {
	let tokens = tokenize(str);
	return tokens.length === 1 && tokens[0].isLink && (
		!type || tokens[0].type === type
	);
};

// Scanner and parser provide states and tokens for the lexicographic stage
// (will be used to add additional link types)
export {find, inherits, options, parser, scanner, test, tokenize};
