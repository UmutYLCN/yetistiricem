import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTopicLines } from '../src/lib/topicList.ts';

test('pasted topic lines keep their trailing duration, in any written form', () => {
  assert.deepEqual(
    parseTopicLines(['Atom ve Periyodik Sistem 45', '', 'Mol Kavramı | 38:20', '  Karışımlar - 1 sa 5 dk  ', 'Kimyasal Tepkimeler', '2023 Sınav Analizi'].join('\n')),
    [
      { title: 'Atom ve Periyodik Sistem', duration: '45' },
      { title: 'Mol Kavramı', duration: '38:20' },
      { title: 'Karışımlar', duration: '1 sa 5 dk' },
      { title: 'Kimyasal Tepkimeler', duration: '' },
      { title: '2023 Sınav Analizi', duration: '' },
    ]
  );
});

test('a line that is only a number stays a title, never an empty topic', () => {
  assert.deepEqual(parseTopicLines('45'), [{ title: '45', duration: '' }]);
});
