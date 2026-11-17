import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import {
  PUBLIC_API_URL, PUBLIC_WS_URL, DEV_PROXY_API_PREFIX, DEV_PROXY_WS_PREFIX,
} from "./src/config/apiEndpoints";
import { createPartnerConfig } from "./src/config/partners/default";
import { resolvePublicEnvironment } from "./src/config/partners/environment";
import type { PartnerConfig } from "./src/config/partners/types";

/** Development-only proxy for the public backend defined in apiEndpoints.ts. */
export function createDevProxy(): Record<string, ProxyOptions> {
  const ws = new URL(PUBLIC_WS_URL);
  const configure: NonNullable<ProxyOptions['configure']> = (server) => {
    // HTTP forwarding is server-to-server. The public WS service requires its
    // approved origin even through a local proxy; this is not an app setting.
    server.on('proxyReq', (request) => request.removeHeader('origin'));
    server.on('proxyReqWs', (request) => request.setHeader('origin', 'https://perps.orbs.network'));
  };
  const proxy: Record<string, ProxyOptions> = {
    [DEV_PROXY_WS_PREFIX]: {
      target: ws.origin,
      changeOrigin: true,
      configure,
      ws: true,
      rewrite: path => `${ws.pathname || "/"}${path.slice(DEV_PROXY_WS_PREFIX.length)}`,
    },
    [DEV_PROXY_API_PREFIX]: {
      target: PUBLIC_API_URL,
      changeOrigin: true,
      configure,
      rewrite: path => path.slice(DEV_PROXY_API_PREFIX.length) || "/",
    },
  };
  return proxy;
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&"<>]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case '<':
        return '&lt;'
      default:
        return '&gt;'
    }
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function setHtmlMetaContent(
  html: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string,
) {
  const metaPattern = new RegExp(
    `<meta\\s+${attributeName}="${escapeRegExp(attributeValue)}"\\s+content="[^"]*"\\s*/?>`,
    'i',
  )
  const replacement = `<meta ${attributeName}="${attributeValue}" content="${escapeHtmlAttribute(content)}" />`

  if (metaPattern.test(html)) {
    return html.replace(metaPattern, replacement)
  }

  return html.replace('</head>', `    ${replacement}\n  </head>`)
}

function setHtmlTitle(html: string, title: string) {
  return html.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtmlAttribute(title)}</title>`,
  )
}

function getImageType(src: string) {
  if (src.endsWith('.svg')) return 'image/svg+xml'
  if (src.endsWith('.png')) return 'image/png'
  if (src.endsWith('.webp')) return 'image/webp'
  return undefined
}

function setHtmlFavicon(html: string, href: string) {
  const type = getImageType(href)
  const typeAttribute = type ? ` type="${type}"` : ''
  const replacement = `<link rel="icon"${typeAttribute} href="${escapeHtmlAttribute(href)}" />`

  if (/<link\s+rel="icon"[^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel="icon"[^>]*>/i, replacement)
  }

  return html.replace('</head>', `    ${replacement}\n  </head>`)
}

export function applyPartnerHtmlMetadata(html: string, partner: PartnerConfig) {
  let nextHtml = setHtmlTitle(html, `${partner.name} | Perpetual Trading`)
  nextHtml = setHtmlMetaContent(nextHtml, 'name', 'theme-color', partner.theme.base)

  if (partner.favicon) {
    nextHtml = setHtmlFavicon(nextHtml, partner.favicon)
  }

  if (partner.previewImageUrl) {
    nextHtml = setHtmlMetaContent(
      nextHtml,
      'property',
      'og:image',
      partner.previewImageUrl,
    )
    nextHtml = setHtmlMetaContent(
      nextHtml,
      'name',
      'twitter:image',
      partner.previewImageUrl,
    )
    nextHtml = setHtmlMetaContent(
      nextHtml,
      'name',
      'twitter:card',
      'summary_large_image',
    )
  }

  if (partner.previewImageType) {
    nextHtml = setHtmlMetaContent(
      nextHtml,
      'property',
      'og:image:type',
      partner.previewImageType,
    )
  }

  return nextHtml
}

function partnerHtmlMetadataPlugin(partner: PartnerConfig): PluginOption {
  return {
    name: 'partner-html-metadata',
    transformIndexHtml(html) {
      return applyPartnerHtmlMetadata(html, partner)
    },
  }
}

export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const environment = resolvePublicEnvironment({ ...env, ...process.env });
  const selectedPartner = createPartnerConfig(environment.partnerId);
  return {
    plugins: [react(), partnerHtmlMetadataPlugin(selectedPartner)],
    define: {
      "import.meta.env.VITE_PARTNER": JSON.stringify(environment.partnerId),
      "import.meta.env.VITE_WALLETCONNECT_PROJECT_ID": JSON.stringify(environment.walletConnectProjectId),
    },
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: command === "serve" && !isPreview
      ? { port: 5174, strictPort: true, proxy: createDevProxy() }
      : undefined,
  };
});
