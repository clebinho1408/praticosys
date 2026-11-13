export class BodyError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
/** Bound input before JSON decoding/validation, including on public auth routes. */
export async function readJsonBody<T = any>(request: Request, maximum = 131_072): Promise<T> {
  if (!request.body) return {} as T;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximum) {
      await reader.cancel();
      throw new BodyError('Requisição muito grande.', 413);
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder().decode(buffer));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BodyError('Objeto JSON obrigatório.');
    return data as T;
  } catch { throw new BodyError('Objeto JSON inválido.'); }
}
