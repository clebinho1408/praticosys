// artifacts/api-server/src/cpf.ts — criptografia AES-256-GCM para campos CPF (Express/Node.js)
// Mesma lógica de functions/_cpf.ts — usa Web Crypto API nativa do Node 18+.

const ENC_PREFIX = 'enc:';

export function isCpfEncrypted(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.startsWith(ENC_PREFIX);
}

export function validateCpfKey(hexKey: string | undefined): string | null {
  if (!hexKey) return 'DATA_ENCRYPTION_KEY não configurada';
  if (hexKey.length !== 64 || !/^[0-9a-f]+$/i.test(hexKey)) {
    return 'DATA_ENCRYPTION_KEY inválida (deve ser 64 caracteres hexadecimais)';
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}

async function importAesKey(hexKey: string): Promise<CryptoKey> {
  const bytes = hexToBytes(hexKey);
  return crypto.subtle.importKey('raw', bytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function importHmacKey(hexKey: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode('hmac-cpf-search\0' + hexKey);
  const derived = await crypto.subtle.digest('SHA-256', material.buffer as ArrayBuffer);
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function cpfSearchHash(cleanDigits: string, hexKey: string): Promise<string> {
  const key = await importHmacKey(hexKey);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(cleanDigits).buffer as ArrayBuffer);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptCpf(
  plain: string | null | undefined,
  hexKey: string,
): Promise<{ enc: string; hash: string } | null> {
  if (!plain) return null;
  const keyError = validateCpfKey(hexKey);
  if (keyError) throw new Error(keyError);

  if (isCpfEncrypted(plain)) {
    const dec = await decryptCpf(plain, hexKey);
    if (!dec) return null;
    const digits = dec.replace(/\D/g, '');
    return { enc: plain, hash: await cpfSearchHash(digits, hexKey) };
  }

  const digits = plain.replace(/\D/g, '');
  if (!digits) return null;

  const key = await importAesKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(digits).buffer as ArrayBuffer,
  );
  const combined = new Uint8Array(12 + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), 12);

  return {
    enc: ENC_PREFIX + btoa(String.fromCharCode(...combined)),
    hash: await cpfSearchHash(digits, hexKey),
  };
}

export async function decryptCpf(stored: string | null | undefined, hexKey: string): Promise<string | null> {
  if (!stored) return null;
  if (!isCpfEncrypted(stored)) return stored;

  const keyError = validateCpfKey(hexKey);
  if (keyError) throw new Error(keyError);

  try {
    const bytes = Uint8Array.from(atob(stored.slice(ENC_PREFIX.length)), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const key = await importAesKey(hexKey);
    const dec = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ct.buffer as ArrayBuffer,
    );
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

export async function decryptCpfInRows<T extends Record<string, any>>(
  rows: T[],
  hexKey: string,
): Promise<any[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { cpf_hash, cpfHash, ...rest } = row as any;
      const cpf = 'cpf' in row ? await decryptCpf(row.cpf, hexKey) : undefined;
      return 'cpf' in row ? { ...rest, cpf } : rest;
    }),
  );
}
