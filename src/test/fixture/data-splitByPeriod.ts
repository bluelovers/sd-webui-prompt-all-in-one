
import type { ISplitByPeriodCase } from '../helpers/node-test-case-types';

export const basicCases: ISplitByPeriodCase[] = [
	{ input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
	{ input: 'hello. world', expected: ['hello.', 'world'] },
	{
		input: 'one.  two.  three', expected: ['one.', 'two.', 'three'],
		note: 'multiple spaces after period',
	},
	{
		input: 'abc.', expected: ['abc.'],
		note: 'trailing period, no space after',
	},
	{
		input: 'abc. ', expected: ['abc.', ''],
		note: 'period + space then end of string',
	},
	{
		input: 'a.b', expected: ['a.b'],
		note: 'period without surrounding space — no split',
	},
]
export const noPeriodCases: ISplitByPeriodCase[] = [
	{ input: 'hello world', expected: ['hello world'] },
	{
		input: '', expected: [''],
		note: 'empty string',
	},
]
export const bracketProtectionCases: ISplitByPeriodCase[] = [
	{ input: 'xxx. (111. 222)', args: [{ includeParen: true }], expected: ['xxx.', '(111. 222)'] },
	{ input: '(111. 222). xxx', args: [{ includeParen: true }], expected: ['(111. 222).', 'xxx'] },
	{
		input: 'xxx. (111. 222', args: [{ includeParen: true }], expected: ['xxx.', '(111. 222'],
		note: 'unclosed paren',
	},
	{
		input: '(111. 222. xxx', args: [{ includeParen: true }], expected: ['(111. 222. xxx'],
		note: 'unclosed paren — no split at all',
	},
	{
		input: 'aaa. (bbb. ccc). ddd. eee', args: [{ includeParen: true }],
		expected: ['aaa.', '(bbb. ccc).', 'ddd.', 'eee'],
	},
	{
		input: 'aaa. [bbb. ccc]. ddd', args: [{ includeParen: true }],
		expected: ['aaa.', '[bbb. ccc].', 'ddd'], note: 'square brackets',
	},
	{
		input: 'aaa. {bbb. ccc}. ddd', args: [{ includeParen: true }],
		expected: ['aaa.', '{bbb. ccc}.', 'ddd'], note: 'curly brackets',
	},
	{
		input: 'a. ((b. c). d). e', args: [{ includeParen: true }],
		expected: ['a.', '((b. c). d).', 'e'], note: 'deeply nested',
	},
	{
		input: 'a. ([b. c]). d', args: [{ includeParen: true }],
		expected: ['a.', '([b. c]).', 'd'], note: 'mixed bracket types',
	},
]
export const includeParenFalseCases: ISplitByPeriodCase[] = [
	{
		input: 'xxx. (111. 222)', args: [{ includeParen: false }], expected: ['xxx. (111. 222)'],
		note: 'first open paren stops',
	},
	{
		input: 'a. b. (c. d)', args: [{ includeParen: false }], expected: ['a.', 'b. (c. d)'],
		note: 'splits first two, stops at third',
	},
	{
		input: 'a. b. [c. d]', args: [{ includeParen: false }], expected: ['a.', 'b. [c. d]'],
		note: 'square bracket stops',
	},
	{
		input: 'a. b. {c. d}', args: [{ includeParen: false }], expected: ['a.', 'b. {c. d}'],
		note: 'curly bracket stops',
	},
	{
		input: '(111. 222). xxx', args: [{ includeParen: false }], expected: ['(111. 222).', 'xxx'],
		note: 'closed paren — split works',
	},
	{
		input: 'a. b. c', args: [{ includeParen: false }], expected: ['a.', 'b.', 'c'],
		note: 'no parens — all splits work',
	},
]
export const mismatchedBracketCases: ISplitByPeriodCase[] = [
	{
		input: 'a. )b. c', args: [{ includeParen: true }], expected: ['a.', ')b.', 'c'],
		note: 'stray close paren ignored',
	},
	{
		input: 'a. ]. b', args: [{ includeParen: true }], expected: ['a.', '].', 'b'],
		note: 'stray close bracket ignored',
	},
	{
		input: '(a. (b. c)). d', args: [{ includeParen: true }],
		expected: ['(a. (b. c)).', 'd'], note: 'nested open parens',
	},
	{
		input: '((a. b). (c. d)). e', args: [{ includeParen: true }],
		expected: ['((a. b). (c. d)).', 'e'], note: 'multiple nested groups',
	},
]
export const nonStringGuardCases: ISplitByPeriodCase[] = [
	{ input: 42, expected: ['42'], note: 'number' },
	{ input: null, expected: ['null'], note: 'null' },
	{ input: undefined, expected: ['undefined'], note: 'undefined' },
	{ input: true, expected: ['true'], note: 'boolean' },
	{ input: { a: 1 }, expected: ['[object Object]'], note: 'object' },
]
export const whitespaceCases: ISplitByPeriodCase[] = [
	{ input: 'a.\tb. c', expected: ['a.', 'b.', 'c'], note: 'tab after period' },
	{ input: 'a.\t  \tb. c', expected: ['a.', 'b.', 'c'], note: 'multiple tabs + spaces' },
	{
		input: 'a.\nb. c', expected: ['a.', '\n', 'b.', 'c'],
		note: 'newline after period — kept as "\\\\n" marker',
	},
	{
		input: 'a.   (b. c)', args: [{ includeParen: true }], expected: ['a.', '(b. c)'],
		note: 'many spaces then open paren',
	},
]
export const semicolonCases: ISplitByPeriodCase[] = [
	{
		input: 'her legs; gnarled trees', expected: ['her legs; gnarled trees'],
		note: 'default off — semicolon is not a split point',
	},
	{
		input: 'her legs; gnarled trees', args: [{ splitSemicolon: false }], expected: ['her legs; gnarled trees'],
		note: 'explicitly off',
	},
	{
		input: 'her legs; gnarled trees', args: [{ splitSemicolon: true }], expected: ['her legs;', 'gnarled trees'],
		note: 'enabled — splits like period, delimiter kept at segment end',
	},
	{
		input: 'a; b. c', args: [{ splitSemicolon: true }], expected: ['a;', 'b.', 'c'],
		note: 'semicolon and period share the same mechanism',
	},
	{
		input: 'legs;;; gnarled', args: [{ splitSemicolon: true }], expected: ['legs;;;', 'gnarled'],
		note: 'consecutive semicolons preserved — not condensed',
	},
	{
		input: 'a;;b', args: [{ splitSemicolon: true }], expected: ['a;;b'],
		note: 'no whitespace after — no split (same mechanism as period)',
	},
	{
		input: 'legs;', args: [{ splitSemicolon: true }], expected: ['legs;'],
		note: 'trailing semicolon — no split, preserved',
	},
	{
		input: 'with "a; b" end', args: [{ splitSemicolon: true }], expected: ['with "a; b" end'],
		note: 'semicolon inside double quotes protected',
	},
	{
		input: '(a; b); c', args: [{ splitSemicolon: true, includeParen: true }], expected: ['(a; b);', 'c'],
		note: 'semicolon inside parens protected, after close splits',
	},
	{
		input: 'a; (b; c)', args: [{ splitSemicolon: true }], expected: ['a; (b; c)'],
		note: 'includeParen=false stops at paren (same as period)',
	},
	{
		input: 'a;\nb', args: [{ splitSemicolon: true }], expected: ['a;', '\n', 'b'],
		note: 'semicolon before newline — split, newline marker kept',
	},
	{
		input: "orks' legs; gnarled trees", args: [{ splitSemicolon: true }], expected: ["orks' legs;", 'gnarled trees'],
		note: 'unclosed single quote (possessive) ignored — semicolon still splits',
	},
]
export const newlineCases: ISplitByPeriodCase[] = [
	{
		input: 'a\nb', expected: ['a', '\n', 'b'],
		note: 'newline always splits — same rule as splitTags (priority > quotes/parens)',
	},
	{
		input: 'a.\nb', expected: ['a.', '\n', 'b'],
		note: 'period split AND newline marker both kept',
	},
	{
		input: '\n', expected: ['\n'],
		note: 'lone newline — splitTags "\\\\n" marker passthrough unchanged',
	},
	{
		input: 'a\n', expected: ['a', '\n'],
		note: 'trailing newline — no empty tail segment',
	},
	{
		input: '\na', expected: ['\n', 'a'],
		note: 'leading newline — no empty head segment',
	},
	{
		input: '\n\n', expected: ['\n', '\n'],
		note: 'consecutive newlines — one marker each',
	},
	{
		input: '"a\nb"', expected: ['"a', '\n', 'b"'],
		note: 'newline inside quotes still splits — newline priority > quote',
	},
	{
		input: 'a "b"\nc', expected: ['a "b"', '\n', 'c'],
		note: 'newline after closed quote',
	},
	{
		input: 'a\nb. c', expected: ['a', '\n', 'b.', 'c'],
		note: 'newline split then period split',
	},
	{
		input: 'a\nb. c', args: [{ includeParen: true }], expected: ['a', '\n', 'b.', 'c'],
		note: 'newline split then period split with includeParen=true',
	},
	{
		input: '(a\nb). c', args: [{ includeParen: true }], expected: ['(a', '\n', 'b).', 'c'],
		note: 'newline in parens splits, paren state reset',
	},
	{
		input: 'a. \n(b)', args: [{ includeParen: false }], expected: ['a.', '\n', '(b)'],
		note: 'newline priority overrides includeParen=false stop',
	},
	{
		input: 'a. "b. c\nd. e', expected: ['a.', '"b. c', '\n', 'd.', 'e'],
		note: 'unclosed quote ends at newline — line 2 period splits normally (quote not carried over)',
	},
]
export const realWorldCases: ISplitByPeriodCase[] = [
	{
		input: 'masterpiece, best quality. (1girl:1.2), looking at viewer',
		args: [{ includeParen: true }],
		expected: ['masterpiece, best quality.', '(1girl:1.2), looking at viewer'],
	},
	{
		input: 'highly detailed. [horse:donkey:0.5]. landscape',
		args: [{ includeParen: true }],
		expected: ['highly detailed.', '[horse:donkey:0.5].', 'landscape'],
	},
	{
		input: '(masterpiece:1.0), best quality. 1girl, {red hair}',
		args: [{ includeParen: true }],
		expected: ['(masterpiece:1.0), best quality.', '1girl, {red hair}'],
	},
	{
		input: 'tag. (nested. prompt. here). end',
		args: [{ includeParen: true }],
		expected: ['tag.', '(nested. prompt. here).', 'end'],
	},
]
export const quoteProtectionCases: ISplitByPeriodCase[] = [
	{
		input: 'with "Small joys. Brighter days." below.',
		args: [{ includeParen: true }],
		expected: ['with "Small joys. Brighter days." below.'],
		note: 'double-quoted sentence preserved',
	},
	{
		input: "with 'Small joys. Brighter days.' below.",
		args: [{ includeParen: true }],
		expected: ["with 'Small joys. Brighter days.' below."],
		note: 'single-quoted sentence preserved',
	},
	{
		input: 'a. "b. c". d',
		args: [{ includeParen: true }],
		expected: ['a.', '"b. c".', 'd'],
		note: 'quotes in middle — split outside only',
	},
	{
		input: '"a. b. c"',
		args: [{ includeParen: true }],
		expected: ['"a. b. c"'],
		note: 'entire string quoted — no split',
	},
	{
		input: '"a. b". "c. d"',
		args: [{ includeParen: true }],
		expected: ['"a. b".', '"c. d"'],
		note: 'two quoted segments',
	},
	{
		input: "it's a. test",
		args: [{ includeParen: true }],
		expected: ["it's a.", 'test'],
		note: 'apostrophe (single char) does not open quote',
	},
	{
		input: 'a. "b. c',
		args: [{ includeParen: true }],
		expected: ['a.', '"b. c'],
		note: 'unclosed double quote — rest is protected to end',
	},
	{
		input: "a. 'b. c",
		args: [{ includeParen: true }],
		expected: ["a.", "'b.", 'c'],
		note: 'unclosed single quote — ignored at segmentation, period splits (same rule as splitTags)',
	},
	{
		input: '"it\'s a. b. c". d',
		args: [{ includeParen: true }],
		expected: ['"it\'s a. b. c".', 'd'],
		note: 'apostrophe inside double-quoted string',
	},
	{
		input: "'hello. world' a. b",
		args: [{ includeParen: true }],
		expected: ["'hello. world' a.", 'b'],
		note: 'closing quote does not split — space after is part of same segment',
	},
	{
		input: "don't stop. go",
		args: [{ includeParen: true }],
		expected: ["don't stop.", 'go'],
		note: 'common contraction — no quote protection',
	},
	{
		input: "path\u00e2's stop. go",
		args: [{ includeParen: true }],
		expected: ["path\u00e2's stop.", 'go'],
		note: 'non-ASCII apostrophe (â) — no quote protection',
	},
	{
		input: "end with '.",
		args: [{ includeParen: true }],
		expected: ["end with '."],
		note: 'single quote at end — opens but no closer, period protected',
	},
]