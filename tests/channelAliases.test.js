import test from 'node:test';
import assert from 'node:assert/strict';
import { expandChannelAliases } from '../src/lib/channelAliases.js';

const aliases = { save: 'salva ora', a: '$b', x: 'espanso' };

test('tokenizer follows the channel alias grammar in one pass', () => {
  assert.equal(expandChannelAliases('$$ciccio', aliases, []), '$ciccio');
  assert.equal(expandChannelAliases('$ciccio', aliases, []), '$ciccio');
  assert.equal(expandChannelAliases('$sysadmin guarda', aliases, ['sysadmin']), '$sysadmin guarda');
  assert.equal(expandChannelAliases('$PATH $1000', aliases, []), '$PATH $1000');
  assert.equal(expandChannelAliases('$a', aliases, []), '$b');
});

test('quoted and code content is inert', () => {
  const input = '> $save\n```sh\n$save\n```\n`$save` $save';
  assert.equal(
    expandChannelAliases(input, aliases, []),
    '> $save\n```sh\n$save\n```\n`$save` salva ora'
  );
});

test('agent namespace takes precedence over an identically named alias', () => {
  assert.equal(expandChannelAliases('$x', aliases, ['x']), '$x');
});
