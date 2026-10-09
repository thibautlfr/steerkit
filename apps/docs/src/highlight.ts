// A tiny TypeScript highlighter for the demos' snippets, which are short and
// written here: comments, strings, numbers, keywords, calls and object keys
// cover them, without shipping a full grammar.

const TOKENS = new RegExp(
	[
		"(?<comment>//[^\\n]*)",
		'(?<string>"[^"\\n]*"|`[^`]*`)',
		"(?<keyword>\\b(?:const|let|function|return|new|import|from|export)\\b)",
		"(?<number>\\b\\d+(?:\\.\\d+)?\\b)",
		"(?<call>\\b[A-Za-z_]\\w*(?=\\())",
		"(?<key>\\b[A-Za-z_]\\w*(?=:))",
	].join("|"),
	"g",
);

const escapeHtml = (text: string): string =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `code` as HTML, each token wrapped in a `<span class="tok-…">`. */
export function highlight(code: string): string {
	let html = "";
	let last = 0;
	for (const match of code.matchAll(TOKENS)) {
		const kind = Object.entries(match.groups ?? {}).find(([, v]) => v)?.[0];
		html += escapeHtml(code.slice(last, match.index));
		html += `<span class="tok-${kind}">${escapeHtml(match[0])}</span>`;
		last = match.index + match[0].length;
	}
	return html + escapeHtml(code.slice(last));
}
