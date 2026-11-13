---
name: Preservar permissões nas correções de segurança
description: Limites exigidos pelo usuário para corrigir segurança sem retirar acessos dos perfis administrativos.
---

Durante as correções de segurança, **não revogar as permissões dos usuários admin, supervisor e operador**.

**Why:** o usuário exigiu expressamente: “só não revogue as permissões dos usuários admin, supervisor e operador.”

**How to apply:** conferir as funções e permissões vigentes desses perfis antes de aplicar bloqueios. Se uma correção exigir retirar um acesso legítimo, apresentar o conflito ao usuário antes de mudar a regra.

Publicação, bloqueio/revogação de sessões reais e rotações de credenciais exigem autorização específica.

**Why:** o usuário incluiu expressamente essa condição ao solicitar as correções.

**How to apply:** preparar e testar correções com dados fictícios sem executar essas ações sobre o ambiente real.
