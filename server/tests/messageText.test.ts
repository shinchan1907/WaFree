import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractContent, isTrackableJid } from '../src/wa/messageText.js';

test('extracts plain conversation text', () => {
  const c = extractContent({ conversation: 'hello world' });
  assert.deepEqual(c, { type: 'text', text: 'hello world', preview: 'hello world' });
});

test('extracts extended text messages', () => {
  const c = extractContent({ extendedTextMessage: { text: 'linked message' } });
  assert.equal(c?.type, 'text');
  assert.equal(c?.text, 'linked message');
});

test('image with caption keeps the caption, without caption uses placeholder', () => {
  assert.equal(extractContent({ imageMessage: { caption: 'sunset' } as never })?.preview, '📷 sunset');
  assert.equal(extractContent({ imageMessage: {} as never })?.preview, '📷 Photo');
});

test('unwraps ephemeral wrapper', () => {
  const c = extractContent({ ephemeralMessage: { message: { conversation: 'secret' } } });
  assert.equal(c?.text, 'secret');
});

test('returns null for protocol-only payloads', () => {
  assert.equal(extractContent({}), null);
  assert.equal(extractContent(null), null);
});

test('trackable jids: users, groups and lids yes; broadcast no', () => {
  assert.equal(isTrackableJid('911234567890@s.whatsapp.net'), true);
  assert.equal(isTrackableJid('12036302@g.us'), true);
  assert.equal(isTrackableJid('98765@lid'), true);
  assert.equal(isTrackableJid('status@broadcast'), false);
  assert.equal(isTrackableJid(null), false);
});
