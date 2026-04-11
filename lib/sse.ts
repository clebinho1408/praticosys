import { Response } from 'express';

let clients: Response[] = [];

export const addClient = (res: Response) => {
  clients.push(res);
  res.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
};

export const broadcast = (event: string, data: any) => {
  clients.forEach(client => {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
};
