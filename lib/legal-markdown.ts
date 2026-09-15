import { marked } from 'marked'

// Cláusulas são só admin-autoradas, mas ainda assim tratadas como entrada não
// confiável (Zero-Alucinação / defesa na borda): qualquer bloco/inline HTML cru
// no Markdown é descartado em vez de renderizado, e só URLs http(s)/mailto/tel
// ou relativas são aceitas em links. Compatível com o runtime do Cloudflare
// Workers — marked não usa módulos nativos do Node.
const renderer = new marked.Renderer()

renderer.html = () => ''
renderer.image = () => ''

const SAFE_URL = /^(https?:|mailto:|tel:|\/)/i
renderer.link = ({ href, text }) =>
  SAFE_URL.test(href ?? '')
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
    : text

marked.use({ renderer })

/**
 * Renderiza o corpo Markdown de uma cláusula jurídica para HTML. Usada tanto
 * pela pré-visualização do painel admin quanto pela página pública — mesmo
 * caminho de renderização, sem risco de divergência entre o que o admin vê e
 * o que o visitante vê.
 */
export function renderLegalMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string
}
