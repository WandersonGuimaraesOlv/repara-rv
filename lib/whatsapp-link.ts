// Link wa.me de clique manual pros painéis do admin (sem envio automático —
// decisão do dono de 21/09/2026). Seguro pro navegador: não puxa nada de
// servidor (o buildWhatsAppAdminLink de modules/notifications fica no módulo
// de notificações, que roda só no servidor).
export function whatsAppLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  const withCountry = digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`
}
