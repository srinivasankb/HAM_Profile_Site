export async function post({ request }) {
  try {
    const body = await request.arrayBuffer();
    const res = await fetch('https://rotate.aprs2.net:8080/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    });
    const responseBody = await res.text();
    return new Response(responseBody, { status: res.status, headers: { 'Content-Type': 'text/plain' } });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
