import type { Plugin } from 'vite';

/**
 * Keep the entry page and its styles in the same response. The standalone CSS
 * assets remain available for preload references and any future lazy chunks.
 */
export function inlineEntryStyles(): Plugin {
  return {
    name: 'praticosys-inline-entry-styles',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.bundle) {
          throw new Error('O build não disponibilizou os estilos da página.');
        }

        const assets = Object.values(context.bundle);
        let inlined = 0;
        const result = html.replace(/<link\b[^>]*>/gi, (link) => {
          if (!/\brel\s*=\s*["']stylesheet["']/i.test(link)) return link;
          const href = link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
          if (!href || /^(?:https?:)?\/\//i.test(href)) return link;

          const asset = assets.find(
            (entry) =>
              entry.type === 'asset' &&
              entry.fileName.endsWith('.css') &&
              href.split(/[?#]/, 1)[0].endsWith(entry.fileName),
          );
          if (!asset || asset.type !== 'asset') {
            throw new Error(`A folha de estilos ${href} não foi encontrada no build.`);
          }

          const css = typeof asset.source === 'string'
            ? asset.source
            : new TextDecoder().decode(asset.source);
          if (!css.trim()) {
            throw new Error(`A folha de estilos ${asset.fileName} está vazia.`);
          }

          inlined += 1;
          // HTML parses </style even inside a CSS string or comment.
          const safeCss = css.replace(/<\/style/gi, '<\\/style');
          return `<style data-praticosys-styles="${asset.fileName}">${safeCss}</style>`;
        });

        if (inlined === 0) {
          throw new Error('O build terminou sem incorporar os estilos principais.');
        }
        return result;
      },
    },
  };
}
