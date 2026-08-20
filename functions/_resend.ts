// functions/_resend.ts — envia e-mail via Resend API (HTTP direto, sem SDK)
// Requer variável de ambiente RESEND_API_KEY no Cloudflare Pages.

export type OtpEmailDelivery =
  | { ok: true }
  | { ok: false; message: string; status?: number };

export async function sendOtpEmail(
  apiKey: string,
  to: string,
  code: string,
  agencyName: string = 'PráticoSys',
  fromEmail: string = 'onboarding@resend.dev',
): Promise<OtpEmailDelivery> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${agencyName} <${fromEmail}>`,
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
    if (resp.ok) return { ok: true };

    // Não registra destinatário, código, chave, nem o corpo retornado pelo provedor.
    console.error('[2fa] Resend recusou o envio do OTP', { status: resp.status });
    if (resp.status === 429) {
      return { ok: false, status: resp.status, message: 'O serviço de e-mail recebeu muitas solicitações. Aguarde um minuto e tente novamente.' };
    }
    if (resp.status === 400 || resp.status === 422) {
      return { ok: false, status: resp.status, message: 'O endereço de e-mail ou o remetente configurado não foi aceito. Confirme o e-mail cadastrado e a configuração do domínio de envio.' };
    }
    if (resp.status === 401) {
      return {
        ok: false,
        status: resp.status,
        message: 'A chave do Resend configurada no Cloudflare Pages foi recusada. Atualize RESEND_API_KEY no ambiente Production e faça um novo deploy.',
      };
    }
    if (resp.status === 403) {
      return {
        ok: false,
        status: resp.status,
        message: 'O Resend recusou o remetente ou a permissão de envio. Configure RESEND_FROM_EMAIL com um endereço de domínio verificado no Resend e confirme que a chave possui permissão de envio.',
      };
    }
    return { ok: false, status: resp.status, message: 'O serviço de e-mail não pôde enviar o código agora. Tente novamente em alguns minutos.' };
  } catch (cause) {
    const timedOut = controller.signal.aborted;
    console.error('[2fa] Falha ao chamar o Resend', {
      reason: timedOut ? 'timeout' : 'network_error',
      error: cause instanceof Error ? cause.name : 'unknown',
    });
    return {
      ok: false,
      message: timedOut
        ? 'O serviço de e-mail demorou demais para responder. Tente novamente em alguns minutos.'
        : 'Não foi possível conectar ao serviço de e-mail. Tente novamente em alguns minutos.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
