/**
	Ticket number detector
	TODO: Add cross-repo style tickets? e.g., SoapBox/linkifyjs#42
	Is that even feasible?
*/
export default function ticket(linkify) {
	let TT = linkify.scanner.TOKENS; // Base Multi token class
	let MultiToken = linkify.parser.TOKENS.Base;
	let S_START = linkify.parser.start;

	function TICKET(value) {
		this.v = value;
	}

	linkify.inherits(MultiToken, TICKET, {
		type: 'ticket',
		isLink: true
	});

	const S_HASH = S_START.jump(TT.POUND);
	const S_TICKET = new linkify.parser.State(TICKET);

	S_HASH.on(TT.NUM, S_TICKET);
}
