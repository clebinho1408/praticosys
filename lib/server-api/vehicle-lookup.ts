
// Vehicle plate lookup via SINESP (Ministério da Justiça)
// Uses the sinesp-api package to query government vehicle data

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sinesp = require('sinesp-api');

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Support both /api/vehicle-lookup?plate=ABC1234 and path param
  const plate = (req.query?.plate || req.params?.plate || '').toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!plate || plate.length < 7) {
    return res.status(400).json({ error: 'Placa inválida. Use formato ABC1234 ou ABC1D23.' });
  }

  try {
    const vehicle = await sinesp.search(plate);

    // sinesp-api returns an object with fields like:
    // brand (marca), model (modelo), color (cor), year (ano/modelYear),
    // plate (placa), state (uf), city (municipio), chassis (chassi)
    return res.status(200).json({
      plate: vehicle.plate || plate,
      brand: vehicle.brand || vehicle.marca || '',
      model: vehicle.model || vehicle.modelo || '',
      color: vehicle.color || vehicle.cor || '',
      year: vehicle.year || vehicle.anoModelo || vehicle.ano || '',
      state: vehicle.state || vehicle.uf || '',
      city: vehicle.city || vehicle.municipio || '',
    });
  } catch (err: any) {
    // SINESP returns an error when plate is not found
    const msg = err?.message || 'Erro na consulta';
    if (msg.includes('not found') || msg.includes('não encontrad') || msg.includes('Plate')) {
      return res.status(404).json({ error: 'Veículo não encontrado para esta placa.' });
    }
    console.error('[vehicle-lookup] Error:', msg);
    return res.status(502).json({ error: 'Serviço de consulta indisponível no momento.' });
  }
}
