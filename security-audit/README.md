# Auditoria de segurança — 13/11/2026

Abra `relatorio.html` para a conclusão, prioridades e limites. O documento é
autossuficiente e não carrega recursos externos.

**Esta entrega é diagnóstico, não remediação.** Não altera a aplicação,
credenciais ou dados reais e não publica uma nova versão.

## Evidências

- `scanners.json`: retornos automáticos reduzidos a metadados e alertas, sem dumps de código.
- `secrets-inventory.json`: apenas caminho, linha e categoria de candidato; nunca valor de segredo.
- `permissions-pages.json` e `permissions-express.json`: resultados observacionais fictícios.
- `public-observations.json`: respostas estáticas públicas, sem chamadas à API de produção.

## Reproduzir com segurança

Da raiz:

```sh
pnpm --filter @workspace/scripts run audit:permissions-pages
pnpm --filter @workspace/scripts run audit:permissions-postgres
```

O primeiro cria D1 efêmero; o segundo usa o lançador existente que limpa
variáveis herdadas e cria PostgreSQL temporário via socket Unix, sem TCP.
Ambos descartam os bancos ao terminar. Não apontar os testes para outro banco.

**Os testes observacionais esperam reproduzir vulnerabilidades existentes.**
O sucesso não é um certificado de segurança e não deve ser usado como regra
de aprovação de uma publicação. Converter em testes de negação após remediação.

As duas ferramentas Python fazem inventário sanitizado de arquivos/histórico
e leitura estática pública. Não leem variáveis de Secrets, não validam chaves
e não fazem chamadas à API de produção. Só executar a leitura pública no
domínio autorizado e quando uma nova observação for necessária.

Não incluir valores reais de senhas, tokens, URLs autenticadas, IPs pessoais
ou documentos de usuários nestes arquivos.
