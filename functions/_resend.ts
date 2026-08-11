// functions/_resend.ts — envia e-mail via Resend API (HTTP direto, sem SDK)
// Requer variável de ambiente RESEND_API_KEY no Cloudflare Pages.

export async function sendOtpEmail(
  apiKey: string,
  to: string,
  code: string,
  agencyName: string = 'PráticoSys'
): Promise<boolean> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${agencyName} <onboarding@resend.dev>`,
        to: [to],
        subject: `[${agencyName}] Código de verificação: ${code}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#1e40af;margin-bottom:8px;">Verificação em 2 etapas</h2>
            <p style="color:#374151;margin-bottom:20px;">Use o código abaixo para concluir seu acesso ao <strong>${agencyName}</strong>:</p>
            <div style="font-size:2.5rem;font-weight:900;letter-spacing:0.35em;color:#1e40af;margin:20px 0;padding:20px;background:#eff6ff;border-radius:12px;text-align:center;border:2px solid #bfdbfe;">${code}</div>
            <p style="color:#6b7280;font-size:0.875rem;">⏱️ Este código expira em <strong>10 minutos</strong>.</p>
            <p style="color:#6b7280;font-size:0.875rem;">🔒 Nunca compartilhe este código com ninguém.</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
            <p style="color:#9ca3af;font-size:0.75rem;">Se você não tentou acessar o sistema, ignore este e-mail.</p>
          </div>
        `,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
