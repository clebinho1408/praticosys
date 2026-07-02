// functions/api/vehicle-lookup.ts  →  GET /api/vehicle-lookup?plate=ABC1234
export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const plate = searchParams.get('plate')?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!plate) {
      return new Response(JSON.stringify({ error: 'Placa é obrigatória' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const resp = await fetch(`https://apicarros.com/v1/consulta/${plate}/json`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Placa não encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'Erro ao consultar placa' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
