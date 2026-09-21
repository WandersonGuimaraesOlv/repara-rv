import { getCloudflareContext } from '@opennextjs/cloudflare'

// Executa uma tarefa "dispara e esquece" sem atrasar a resposta.
//
// No Cloudflare Workers uma promessa solta (`void fetch(...)`) pode ser
// CANCELADA assim que a resposta é enviada — o `waitUntil` do contexto é o que
// mantém a tarefa viva até acabar. Fora do Workers (testes, Node puro) cai pro
// comportamento simples. Erros da tarefa são só logados, nunca propagados.
export function runInBackground(task: Promise<unknown>): void {
  const guarded = task.catch((error) => {
    console.warn('[background] tarefa em segundo plano falhou:', error)
  })

  try {
    getCloudflareContext().ctx.waitUntil(guarded)
  } catch {
    void guarded
  }
}
