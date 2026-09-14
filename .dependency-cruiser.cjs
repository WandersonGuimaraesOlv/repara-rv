module.exports = {
  forbidden: [
    {
      name: 'edge-runtime-compatibility',
      comment: 'Proíbe módulos nativos do Node no Edge/Cloudflare Workers',
      severity: 'error',
      from: { path: '^app' },
      to: { dependencyTypes: ['core'], pathNot: ['^(crypto|buffer)$'] }
    },
    {
      name: 'ui-cannot-bypass-server-boundary',
      comment: 'Componentes de UI nunca podem importar clients autenticados ou de admin diretamente',
      severity: 'error',
      from: { path: '^components' },
      to: { path: '^lib/supabase/(server|admin)' }
    },
    {
      name: 'no-cross-module-internal-imports',
      comment: 'Módulos devem se comunicar APENAS pelo index.ts público. Proibido importar arquivos internos de outro módulo.',
      severity: 'error',
      from: { path: '^modules/([^/]+)/' },
      to: {
        path: '^modules/([^/]+)/',
        pathNot: '^modules/$1/|^modules/[^/]+/index\\.ts$'
      }
    },
    {
      name: 'module-ui-cannot-access-database',
      comment: 'Componentes de UI dentro de módulos nunca chamam o banco diretamente',
      severity: 'error',
      from: { path: '^modules/[^/]+/components' },
      to: { path: '^lib/supabase/(server|admin)' }
    },
    {
      name: 'app-layer-no-direct-lib-db',
      comment: 'Páginas e route handlers em app/ consomem módulos, não lib/supabase diretamente (exceto auth)',
      severity: 'warn',
      from: { path: '^app/((?!api/auth).)*' },
      to: { path: '^lib/supabase/(server|admin)' }
    }
  ]
};
