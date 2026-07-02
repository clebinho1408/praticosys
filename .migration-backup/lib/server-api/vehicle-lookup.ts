
// Vehicle plate lookup via apicarros.com (espelho do SINESP)
// Endpoint: GET https://apicarros.com/v1/consulta/{plate}/json

import https from 'https';

const PLATE_RE = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$|^[A-Z]{3}[0-9]{2}[A-Z][0-9]$/;

function httpGet(url: string, timeoutMs = 10000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out after ' + timeoutMs + 'ms'));
    });
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const plate = (req.query?.plate || req.params?.plate || '')
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!plate || plate.length < 7) {
    return res.status(400).json({ error: 'Placa inválida. Use formato ABC1234 ou ABC1D23.' });
  }

  if (!PLATE_RE.test(plate)) {
    return res.status(400).json({ error: 'Formato de placa inválido. Use ABC1234 (antiga) ou ABC1D23 (Mercosul).' });
  }

  try {
    const url = `https://apicarros.com/v1/consulta/${plate}/json`;
    const { status, body } = await httpGet(url, 9000);

    if (status === 404) {
      return res.status(404).json({ error: 'Veículo não encontrado para esta placa.' });
    }

    if (status !== 200) {
      console.error(`[vehicle-lookup] apicarros.com returned ${status} for plate ${plate}`);
      return res.status(503).json({ error: 'Serviço indisponível. Preencha marca e modelo manualmente.' });
    }

    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(503).json({ error: 'Resposta inválida do serviço. Preencha manualmente.' });
    }

    // codigoRetorno === '0' means success
    if (data.codigoRetorno && data.codigoRetorno !== '0') {
      const msg: string = data.mensagemRetorno || '';
      if (msg.toLowerCase().includes('não encontrad') || msg.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: 'Veículo não encontrado para esta placa.' });
      }
      return res.status(503).json({ error: 'Serviço indisponível. Preencha marca e modelo manualmente.' });
    }

    return res.status(200).json({
      plate:  data.placa       || data.plate  || plate,
      brand:  data.marca       || data.brand  || '',
      model:  data.modelo      || data.model  || '',
      color:  data.cor         || data.color  || '',
      year:   data.anoModelo   || data.ano    || data.year || '',
      state:  data.uf          || data.state  || '',
      city:   data.municipio   || data.city   || '',
    });

  } catch (err: any) {
    const msg: string = err?.message || '';
    console.error('[vehicle-lookup] Error:', msg);
    if (msg.includes('timed out')) {
      return res.status(503).json({ error: 'Consulta excedeu o tempo limite. Preencha manualmente.' });
    }
    return res.status(503).json({ error: 'Serviço indisponível. Preencha marca e modelo manualmente.' });
  }
}
