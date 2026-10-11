let clients = [];
export const addClient = (res) => {
    clients.push(res);
    res.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
};
export const broadcast = (event, data) => {
    clients.forEach(client => {
        client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
};
