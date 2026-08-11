import net from 'net';

export async function POST({ request }) {
  try {
    const payload = await request.text();
    // Ensure payload ends with CRLF as required by APRS-IS
    const data = payload.endsWith('\r\n') ? payload : payload + '\r\n';
    return await new Promise((resolve) => {
      const client = net.createConnection({ host: 'rotate.aprs2.net', port: 14580 }, () => {
        client.write(data);
      });
      let response = '';
      client.on('data', (chunk) => {
        response += chunk.toString();
      });
      client.on('end', () => {
        resolve(new Response(response || 'OK', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
      });
      client.on('error', (err) => {
        resolve(new Response(err.message, { status: 500 }));
      });
    });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}

