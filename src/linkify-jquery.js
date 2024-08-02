import linkifyElement from './linkify-element';

// Applies the plugin to jQuery
export default function apply($, doc = false) {

	$.fn = $.fn || {};

	try {
		doc = doc || document || window && window.document || global && global.document;
	} catch (e) { /* do nothing for now */ }

	if (!doc) {
		throw new Error(
			'Cannot find document implementation. ' +
			'If you are in a non-browser environment like Node.js, ' +
			'pass the document implementation as the second argument to linkify/jquery'
		);
	}

	if (typeof $.fn.linkify === 'function') {
		// Already applied
		return;
	}

	function jqLinkify(opts) {
		opts = linkifyElement.normalize(opts);
		return this.each(function () {
			linkifyElement.helper(this, opts, doc);
		});
	}

	$.fn.linkify = jqLinkify;

	$(doc).ready(function () {
		$('[data-linkify]').each(function () {
			let $this = $(this);
			let data = $this.data();
			let target = data.linkify;
			let nl2br = data.linkifyNlbr;

			let options = {
				nl2br: !!nl2br && nl2br !== 0 && nl2br !== 'false'
			};

			if ('linkifyAttributes' in data) {
				options.attributes = data.linkifyAttributes;
			}

			if ('linkifyDefaultProtocol' in data) {
				options.defaultProtocol = data.linkifyDefaultProtocol;
			}

			if ('linkifyEvents' in data) {
				options.events = data.linkifyEvents;
			}

			if ('linkifyFormat' in data) {
				options.format = data.linkifyFormat;
			}

			if ('linkifyFormatHref' in data) {
				options.formatHref = data.linkifyFormatHref;
			}

			if ('linkifyTagname' in data) {
				options.tagName = data.linkifyTagname;
			}

			if ('linkifyTarget' in data) {
				options.target = data.linkifyTarget;
			}

			if ('linkifyValidate' in data) {
				options.validate = data.linkifyValidate;
			}

			if ('linkifyIgnoreTags' in data) {
				options.ignoreTags = data.linkifyIgnoreTags;
			}

			if ('linkifyClassName' in data) {
				options.className = data.linkifyClassName;
			} else if ('linkifyLinkclass' in data) { // linkClass is deprecated
				options.className = data.linkifyLinkclass;
			}

			options = linkifyElement.normalize(options);

			let $target = target === 'this' ? $this : $this.find(target);
			$target.linkify(options);
		});
	});
}

// Try assigning linkifyElement to the browser scope
try { !this.define && (window.linkifyElement = linkifyElement); } catch (e) { /**/ }
