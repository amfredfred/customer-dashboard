/**
 * Returns the HTTP base URL for the execution gateway, derived from the
 * public WebSocket URL so only one env var is needed.
 */
export function gatewayHttpBase(): string {
  const wsUrl =
    process.env.NEXT_PUBLIC_GATEWAY_WS_URL ??
    "wss://apex-gateway.somicast.com/dashboard";
  const http = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try {
    return new URL(http).origin;
  } catch {
    return "https://apex-gateway.somicast.com";
  }
}
