import { decryptSecret, encryptSecret } from './crypto.util';

const SECRET = 'test-encryption-key-please-change';

describe('crypto.util (AES-256-GCM)', () => {
  it('round-trips a value', () => {
    const plain = 'google-refresh-token-1//abcDEF';
    const enc = encryptSecret(plain, SECRET);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc, SECRET)).toBe(plain);
  });

  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptSecret('x', SECRET)).not.toBe(encryptSecret('x', SECRET));
  });

  it('fails to decrypt with the wrong secret', () => {
    const enc = encryptSecret('secret', SECRET);
    expect(() => decryptSecret(enc, 'wrong-secret')).toThrow();
  });

  it('rejects malformed ciphertext', () => {
    expect(() => decryptSecret('garbage', SECRET)).toThrow('Malformed ciphertext');
  });
});
