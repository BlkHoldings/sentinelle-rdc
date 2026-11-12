/** Path to a file in /public, honouring the deployment base path. */
export function asset(path: string): string {
  const base = process.env.NODE_ENV === 'production' ? '/sentinelle-rdc' : '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
