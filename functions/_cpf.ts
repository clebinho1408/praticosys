// functions/_cpf.ts — criptografia AES-256-GCM para campos CPF
// Compatível com Web Crypto API (Node 18+ e Cloudflare Workers).
//
// Design:
//   - Randomized AES-256-GCM: cada CPF recebe um IV aleatório de 12 bytes → sem reuso de nonce.
//   - Coluna cpf: guarda 'enc:<base64(iv + ciphertext + tag)>'
//   - Coluna cpf_hash: HMAC-SHA256 dos dígitos limpos (chave derivada) — permite busca exata sem expor o CPF.
//   - Migração transparente: registros antigos em texto puro são aceitos na leitura e re-criptografados na próxima escrita.
//   - Fail closed: se DATA_ENCRYPTION_KEY não estiver configurada, qualquer escrita de CPF lança erro 503.

const ENC_PREFIX = 'enc:';

/** Retorna true se o valor já está criptografado. */
export function isCpfEncrypted(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.startsWith(ENC_PREFIX);
}

/** Valida o formato da chave (64 chars hex = 32 bytes). Retorna mensagem de erro ou null. */
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

/**
 * Deriva uma chave HMAC separada da chave AES usando SHA-256.
 * Separação de domínio: evita que a mesma chave seja usada diretamente em dois algoritmos.
 */
async function importHmacKey(hexKey: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode('hmac-cpf-search\0' + hexKey);
  const derived = await crypto.subtle.digest('SHA-256', material.buffer as ArrayBuffer);
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * Calcula HMAC-SHA256 dos dígitos do CPF para busca exata.
 * Armazenado em cpf_hash; não revela o CPF.
 */
export async function cpfSearchHash(cleanDigits: string, hexKey: string): Promise<string> {
  const key = await importHmacKey(hexKey);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(cleanDigits).buffer as ArrayBuffer);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Criptografa um CPF com AES-256-GCM (IV aleatório a cada chamada).
 * Retorna { enc, hash } — enc vai para cpf, hash vai para cpf_hash.
 * Lança Error se a chave não estiver configurada.
 */
export async function encryptCpf(
  plain: string | null | undefined,
  hexKey: string,
): Promise<{ enc: string; hash: string } | null> {
  if (!plain) return null;
  const keyError = validateCpfKey(hexKey);
  if (keyError) throw new Error(keyError);

  // Já criptografado: apenas recalcula o hash (caso o hash esteja ausente)
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

/**
 * Descriptografa um CPF.
 * - Texto puro (sem 'enc:'): retorna como está (migração de dados antigos).
 * - Falha na descriptografia: retorna null (não expõe dado corrompido).
 */
export async function decryptCpf(stored: string | null | undefined, hexKey: string): Promise<string | null> {
  if (!stored) return null;
  if (!isCpfEncrypted(stored)) return stored; // texto puro legado — migração transparente

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
    return null; // não expõe dado corrompido
  }
}

/**
 * Descriptografa o campo cpf em um array de registros e remove cpf_hash da resposta da API.
 */
export async function decryptCpfInRows<T extends Record<string, any>>(
  rows: T[],
  hexKey: string,
): Promise<any[]> {
  return Promise.all(
    rows.map(async (row) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cpf_hash, cpfHash, ...rest } = row as any;
      const cpf = 'cpf' in row ? await decryptCpf(row.cpf, hexKey) : undefined;
      return 'cpf' in row ? { ...rest, cpf } : rest;
    }),
  );
}
