import { lookupVehicleWithApiFull, VehicleLookupError } from "../_vehicle-lookup.js";

// functions/api/vehicle-lookup.ts  →  GET /api/vehicle-lookup?plate=ABC1234
export const onRequestGet: PagesFunction<{ API_FULL_TOKEN: string }> = async ({ request, env, data }) => {
  try {
    const session = data as { sessionUserId?: string; sessionUserRole?: string };
    if (!["ADMIN", "SUPERVISOR", "OPERATOR"].includes(session.sessionUserRole || "")) {
      return Response.json({ error: "Você não tem permissão para consultar veículos." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const result = await lookupVehicleWithApiFull(
      env.API_FULL_TOKEN,
      searchParams.get("plate"),
      session.sessionUserId || "anonymous",
    );
    return Response.json(result);
  } catch (error) {
    const status = error instanceof VehicleLookupError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Erro ao consultar placa";
    return Response.json({ error: message }, { status });
  }
};
