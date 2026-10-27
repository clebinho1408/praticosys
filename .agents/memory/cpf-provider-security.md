---
name: Segurança da integração APICPF
description: Credencial exposta no pedido original e limites de autorização para validar a integração.
---

Não reutilizar a credencial APICPF presente no anexo original. Solicitar
uma chave substituta pelo formulário seguro; não transferir a chave do
anexo para código, configurações públicas ou ambiente.

**Why:** o pedido original incluiu uma credencial em texto aberto; ela
foi tratada como exposta, e o usuário foi orientado a substituí-la.

**How to apply:** ao configurar ou ativar o serviço, usar somente uma
credencial nova fornecida pelo fluxo seguro. Validação com pessoas reais,
consumo de créditos, ativação no site publicado e migrações no Neon
compartilhado não estão autorizados pelo pedido de implementação.
