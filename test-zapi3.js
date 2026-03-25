import https from 'https';

const data = JSON.stringify({
  phone: '5511999999999',
  message: 'test'
});

const req = https.request('https://api.z-api.io/instances/3B123/token/CB47F4C806C103A0B0BB97C9/send-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
