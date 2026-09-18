export interface VehicleLookupResult {
  plate: string;
  brand: string;
  model: string;
  brandModel: string;
  modelYear: string;
}

export class VehicleLookupError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "VehicleLookupError";
  }
}

const normalizeKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value).trim()
    : "";

const lookupCache = new Map<string, { expiresAt: number; result: VehicleLookupResult }>();
const lastLookupByActor = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_MS = 2_500;

function findValue(source: unknown, aliases: string[], maxDepth = 3): string {
  const wanted = new Set(aliases.map(normalizeKey));
  const queue: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];

  while (queue.length) {
    const current = queue.shift()!;
    if (!current.value || typeof current.value !== "object") continue;
    const record = current.value as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      if (wanted.has(normalizeKey(key))) {
        const text = normalizeText(value);
        if (text) return text;
      }
    }

    if (current.depth < maxDepth) {
      for (const value of Object.values(record)) {
        if (value && typeof value === "object") {
          if (Array.isArray(value)) {
            value.slice(0, 3).forEach((item) => queue.push({ value: item, depth: current.depth + 1 }));
          } else {
            queue.push({ value, depth: current.depth + 1 });
          }
        }
      }
    }
  }
  return "";
}

function splitBrandModel(combined: string): { brand: string; model: string } {
  const slashParts = combined.split(/\s*[/|]\s*/).filter(Boolean);
  if (slashParts.length >= 2) {
    return { brand: slashParts[0], model: slashParts.slice(1).join(" / ") };
  }
  const dashParts = combined.split(/\s+-\s+/).filter(Boolean);
  if (dashParts.length >= 2) {
    return { brand: dashParts[0], model: dashParts.slice(1).join(" - ") };
  }
  const [brand = "", ...modelParts] = combined.split(/\s+/);
  return { brand, model: modelParts.join(" ") };
}

function providerError(payload: unknown, httpStatus: number): VehicleLookupError | null {
  const status = findValue(payload, ["status"], 1);
  const normalizedStatus = normalizeKey(status);
  const succeeded =
    !status ||
    ["1", "200", "true"].includes(normalizedStatus) ||
    /(sucesso|success|realizad|concluid|^ok$)/.test(normalizedStatus);

  if (httpStatus >= 200 && httpStatus < 300 && succeeded) return null;

  const rawMessage =
    findValue(payload, ["mensagem", "message", "erro", "error", "descricao", "description"], 3) ||
    status;
  const normalizedMessage = normalizeKey(rawMessage);

  if (httpStatus === 404 || /(naoencontr|inexistent|semregistro)/.test(normalizedMessage)) {
    return new VehicleLookupError("Veículo não encontrado para a placa informada.", 404);
  }
  if (httpStatus === 402 || /(saldo|credito|credit|limite|cota)/.test(normalizedMessage)) {
    return new VehicleLookupError("Saldo insuficiente na API Full para realizar a consulta.", 402);
  }
  if ([401, 403].includes(httpStatus) || /(token|autentic|unauthor|forbidden|credencial)/.test(normalizedMessage)) {
    return new VehicleLookupError("A autenticação da API Full precisa ser verificada.", 502);
  }
  if (httpStatus >= 500 || /(indispon|provedor|timeout|temporari)/.test(normalizedMessage)) {
    return new VehicleLookupError("A API Full está temporariamente indisponível.", 503);
  }
  return new VehicleLookupError(rawMessage || "A API Full não conseguiu concluir a consulta.", 422);
}

export function normalizeVehiclePlate(value: unknown): string {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function mapApiFullVehicle(payload: unknown, requestedPlate: string): VehicleLookupResult {
  const data =
    payload && typeof payload === "object" && "dados" in (payload as Record<string, unknown>)
      ? (payload as Record<string, unknown>).dados
      : payload;

  const combined = findValue(data, ["marcamodelo", "marca_modelo", "marca/modelo", "veiculomodelo"]);
  let brand = findValue(data, ["marca", "veimarca", "brand"]);
  let model = findValue(data, ["modelo", "veimodelo", "model"]);

  if ((!brand || !model) && combined) {
    const parsed = splitBrandModel(combined);
    brand ||= parsed.brand;
    model ||= parsed.model;
  }

  const modelYear = findValue(data, [
    "veianomodelo",
    "anomodelo",
    "ano_modelo",
    "modelyear",
    "yearmodel",
    "anomod",
  ]).match(/\d{4}/)?.[0] || "";

  if (!brand || !model || !modelYear) {
    throw new VehicleLookupError(
      "A consulta foi concluída, mas a API Full não retornou marca, modelo e ano do modelo.",
      422,
    );
  }

  const plate = normalizeVehiclePlate(findValue(data, ["placa", "plate"]) || requestedPlate);
  const normalizedBrand = brand.toUpperCase();
  const normalizedModel = model.toUpperCase();
  return {
    plate: plate || requestedPlate,
    brand: normalizedBrand,
    model: normalizedModel,
    brandModel: `${normalizedBrand} / ${normalizedModel}`,
    modelYear,
  };
}

export async function lookupVehicleWithApiFull(
  token: string | undefined,
  rawPlate: unknown,
  actorKey = "anonymous",
): Promise<VehicleLookupResult> {
  const plate = normalizeVehiclePlate(rawPlate);
  if (!/^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(plate)) {
    throw new VehicleLookupError("Informe uma placa brasileira válida.", 400);
  }
  if (!token?.trim()) {
    throw new VehicleLookupError("A consulta de veículos ainda não foi configurada.", 503);
  }

  const cached = lookupCache.get(plate);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) lookupCache.delete(plate);

  const lastLookup = lastLookupByActor.get(actorKey) || 0;
  if (Date.now() - lastLookup < RATE_LIMIT_MS) {
    throw new VehicleLookupError("Aguarde alguns segundos antes de fazer outra consulta.", 429);
  }
  lastLookupByActor.set(actorKey, Date.now());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.apifull.com.br/api/veiculo-dados-basicos", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ link: "veiculo-dados-basicos", placa: plate }),
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      throw new VehicleLookupError("A API Full retornou uma resposta inválida.", 503);
    }

    const failure = providerError(payload, response.status);
    if (failure) throw failure;
    const result = mapApiFullVehicle(payload, plate);
    lookupCache.set(plate, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  } catch (error) {
    if (error instanceof VehicleLookupError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new VehicleLookupError("A consulta demorou demais. Tente novamente.", 504);
    }
    throw new VehicleLookupError("Não foi possível acessar a API Full.", 503);
  } finally {
    clearTimeout(timeout);
  }
}