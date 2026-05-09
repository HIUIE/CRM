/**
 * SmartTrade ERP - E2EE 备份与恢复加解密核心库
 * 基于 Web Crypto API 实现高强度客户端数据保护
 */

const MAGIC_HEADER = new Uint8Array([83, 84, 69, 50, 69, 69, 1]); // "STE2EE\x01"
const SALT_SIZE = 16; // 16 字节 Salt
const IV_SIZE = 12; // 12 字节 IV (AES-GCM 标准)
const PBKDF2_ITERATIONS = 100000; // 100,000 次哈希迭代防暴力破解

/**
 * 验证一个文件二进制 Buffer 是否是合法的 E2E 加密包
 */
export function isEncryptedBackup(data: ArrayBuffer): boolean {
  if (data.byteLength < MAGIC_HEADER.length + SALT_SIZE + IV_SIZE) {
    return false;
  }
  const view = new Uint8Array(data);
  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (view[i] !== MAGIC_HEADER[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 基于密码和 Salt 派生 AES-GCM 256 位密钥
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密灾备备份数据
 * @param zipData 原始标准 ZIP 文件的 ArrayBuffer
 * @param password 用户设置的加密密码
 */
export async function encryptBackup(zipData: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  // 1. 生成随机 Salt 和 IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));

  // 2. 派生加密 Key
  const key = await deriveKey(password, salt);

  // 3. 执行 AES-GCM 加密
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    zipData
  );

  // 4. 打包为魔数 + Salt + IV + 密文的混合二进制结构
  const packed = new Uint8Array(MAGIC_HEADER.length + SALT_SIZE + IV_SIZE + ciphertext.byteLength);
  packed.set(MAGIC_HEADER, 0);
  packed.set(salt, MAGIC_HEADER.length);
  packed.set(iv, MAGIC_HEADER.length + SALT_SIZE);
  packed.set(new Uint8Array(ciphertext), MAGIC_HEADER.length + SALT_SIZE + IV_SIZE);

  return packed.buffer;
}

/**
 * 解密灾备备份数据
 * @param encryptedData 加密的 ArrayBuffer
 * @param password 用户输入的解密密码
 */
export async function decryptBackup(encryptedData: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  if (!isEncryptedBackup(encryptedData)) {
    throw new Error('INVALID_ENCRYPTION_HEADER');
  }

  const packed = new Uint8Array(encryptedData);

  // 1. 提取 Salt 和 IV
  const salt = packed.slice(MAGIC_HEADER.length, MAGIC_HEADER.length + SALT_SIZE);
  const iv = packed.slice(MAGIC_HEADER.length + SALT_SIZE, MAGIC_HEADER.length + SALT_SIZE + IV_SIZE);
  const ciphertext = packed.slice(MAGIC_HEADER.length + SALT_SIZE + IV_SIZE);

  // 2. 派生解密 Key
  const key = await deriveKey(password, salt);

  try {
    // 3. 解密密文
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );
    return decrypted;
  } catch (error) {
    // 解密失败（密码错误、内容损坏或篡改）
    throw new Error('DECRYPTION_FAILED');
  }
}
