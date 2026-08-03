/** Builds a WebSocket URL from a server URL, channel address, and query params — shared across all `ws`-based clients. */
export function buildWsUrl(
  serverUrl: string,
  channelAddress: string,
  query: Record<string, string>,
): string {
  const base = serverUrl.replace(/\/$/, "");
  const path = channelAddress.startsWith("/") ? channelAddress : `/${channelAddress}`;
  const search = new URLSearchParams(query).toString();
  return search ? `${base}${path}?${search}` : `${base}${path}`;
}
