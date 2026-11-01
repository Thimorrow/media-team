import { handleRequest } from '../server/app.mjs';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.has('route')) {
    const route = url.searchParams.get('route');
    url.searchParams.delete('route');
    req.url = `/api/${route}${url.search}`;
  }
  return handleRequest(req, res);
}
