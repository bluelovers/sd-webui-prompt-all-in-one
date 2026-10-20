import { test } from 'node:test';
import { _getPromptOptionValueRecord } from '#/src/utils/promptOptions';
import { loadPromptOptionsFromStorage } from '#/test/helpers/promptOptions-io';

test('promptOptions:snapshot', (t) => {
	const data = _getPromptOptionValueRecord();
	const overridden = loadPromptOptionsFromStorage();
	t.assert.snapshot({
		default: data,
		overridden,
	})
})
