import { describe, it, expect, beforeAll } from 'vitest';
import { encryptBackup, decryptBackup, isEncryptedBackup } from '../backup-crypto';

describe('Backup Cryptography (E2EE)', () => {
  const mockPassword = 'TestSecureBackupPassword123!';
  const mockText = 'This is a simulation of the standard ZIP system backup file contents. Let us make it slightly long to represent actual relational database and file archive snapshots.';
  let mockData: ArrayBuffer;

  beforeAll(() => {
    const encoder = new TextEncoder();
    mockData = encoder.encode(mockText).buffer;
  });

  it('should correctly identify encrypted vs unencrypted buffers', async () => {
    // 1. Unencrypted data should be identified as false
    expect(isEncryptedBackup(mockData)).toBe(false);

    // 2. Encrypt the data
    const encrypted = await encryptBackup(mockData, mockPassword);

    // 3. Encrypted data should be identified as true
    expect(isEncryptedBackup(encrypted)).toBe(true);
  });

  it('should successfully encrypt and decrypt data with the correct password', async () => {
    // 1. Encrypt
    const encrypted = await encryptBackup(mockData, mockPassword);
    expect(encrypted.byteLength).toBeGreaterThan(mockData.byteLength);

    // 2. Decrypt
    const decrypted = await decryptBackup(encrypted, mockPassword);

    // 3. Compare content
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decrypted);
    expect(decryptedText).toBe(mockText);
  });

  it('should fail decryption if an incorrect password is provided', async () => {
    // 1. Encrypt
    const encrypted = await encryptBackup(mockData, mockPassword);

    // 2. Try to decrypt with wrong password
    await expect(decryptBackup(encrypted, 'wrong-password')).rejects.toThrow('DECRYPTION_FAILED');
  });

  it('should fail decryption if the backup magic header is corrupt or missing', async () => {
    // 1. Encrypt
    const encrypted = await encryptBackup(mockData, mockPassword);

    // 2. Corrupt the magic header (first byte)
    const view = new Uint8Array(encrypted);
    view[0] = 99; // Change 'S' (83) to 'c' (99)

    // 3. Decrypt should fail with invalid header error
    await expect(decryptBackup(encrypted, mockPassword)).rejects.toThrow('INVALID_ENCRYPTION_HEADER');
  });
});
