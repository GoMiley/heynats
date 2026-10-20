/**
 * What the server says about itself, injected into index.html as
 * `window.__HEYNATS__`: the path the dashboard is served under, and whether
 * writes are shown. Falls back to the root and to writes hidden.
 */
interface ServerUIConfig {
  basePath: string;
  readOnly: boolean;
}

const injected =
  (window as unknown as { __HEYNATS__?: Partial<ServerUIConfig> })
    .__HEYNATS__ ?? {};

export const serverConfig: ServerUIConfig = {
  basePath: injected.basePath ?? '',
  readOnly: injected.readOnly ?? true,
};

/** An absolute URL for an API path, under the base path: apiUrl('/nats/status'). */
export const apiUrl = (path: string) => `${serverConfig.basePath}/api${path}`;
