export function teachingYoutubeUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("YouTube 영상 주소를 확인해 주세요."); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error("YouTube 영상 주소를 확인해 주세요.");
  const host = url.hostname.toLowerCase();
  const id = host === 'youtu.be' ? url.pathname.slice(1)
    : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
      ? (url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : '') : '';
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error("YouTube 영상·쇼츠 주소만 입력할 수 있습니다.");
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Bound bodies before JSON/multipart parsing; never fetch a caller-supplied host. */
export async function boundedSourceBody(req: Request, maximum: number): Promise<Uint8Array> {
  if (Number(req.headers.get('content-length')) > maximum) throw new Error("파일 크기 한도를 초과했습니다.");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("입력이 비어 있습니다.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new Error("파일 크기 한도를 초과했습니다."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
