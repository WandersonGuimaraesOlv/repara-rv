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
    }
  ]
};
