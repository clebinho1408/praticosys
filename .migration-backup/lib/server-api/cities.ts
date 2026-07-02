
import { db } from '../../db/index.js';
import { cities } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const parseBody = (req: any) => {
    try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return req.body;
    }
};

export default async function handler(req: any, res: any) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const data = await db.select().from(cities);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body.name) return res.status(400).json({ error: 'Nome é obrigatório' });
      
      const newCity = {
        id: uuidv4(),
        name: body.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        createdAt: new Date()
      };
      
      await db.insert(cities).values(newCity);
      return res.status(201).json(newCity);
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);
      const cityId = body.id || id;
      if (!cityId) return res.status(400).json({ error: 'ID é obrigatório' });
      
      const updates: any = {};
      if (body.name) {
        updates.name = body.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }
      
      await db.update(cities).set(updates).where(eq(cities.id, cityId));
      return res.status(200).json({ id: cityId, ...updates });
    }

    if (req.method === 'DELETE') {
      const cityId = req.query.id;
      if (!cityId) return res.status(400).json({ error: 'ID é obrigatório' });
      
      await db.delete(cities).where(eq(cities.id, cityId));
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error: any) {
    console.error("[API Cities] Erro:", error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}
