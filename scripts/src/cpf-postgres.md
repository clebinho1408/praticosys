# CPF: integração Express/PostgreSQL isolada

Execute na raiz:

```sh
pnpm --filter @workspace/scripts run test:cpf-postgres
```

Requer Node/pnpm e os executáveis PostgreSQL (`initdb`, `pg_ctl` e
`createdb`) no `PATH`, com usuário não root. Neste ambiente os executáveis já
estão disponíveis. Caso faltem em outro ambiente Replit, instalar PostgreSQL
pelas ferramentas de pacotes da plataforma; não requer Docker nem ambiente
virtual.

O lançador cria um cluster em diretório temporário, sem listener TCP, e
executa o teste em processo separado com ambiente permitido explicitamente.
Não encaminha `DATA_BASE_NEON`, `DATABASE_URL`, `APICPF_API_KEY` ou outras
credenciais do workspace. A única URL entregue ao processo aponta ao socket
Unix do cluster recém-criado. O processo verifica esse destino antes de
importar o módulo de banco.

A integração carrega o aplicativo Express real (sem executar o bootstrap
`index.ts`, que também contém migrações e inicialização não relacionadas).
Executa o SQL compartilhado da migração CPF sobre uma estrutura anterior à
funcionalidade e usa o middleware de sessão, as rotas e o pool PostgreSQL
reais. Sessões são inseridas como fixtures para não acionar login/OTP/email.
As requisições HTTP locais pertencem somente ao servidor de teste efêmero,
não aos serviços da prévia.

Todo `fetch` do processo de integração é interceptado, sem fallback de rede.
Somente o CPF sintético fixado e a chave fictícia são aceitos na simulação.
O teste verifica migração aditiva/idempotente, padrão desativado, persistência
das configurações, sessões ausentes/inválidas/expiradas, perfis e módulos,
chave ausente, resposta mínima sem dados adicionais, bloqueio desativado e
cota atômica de 10 consultas em 24 requisições concorrentes, além da separação
por usuário e renovação da janela. O relógio da cota é fixado durante a
concorrência para não depender da virada do minuto.

Ao terminar (inclusive em falhas de asserção), o lançador encerra o cluster e
remove seu diretório. O processo de integração tem limite de 90 segundos.
Nada é migrado no Neon compartilhado e nenhum workflow da aplicação precisa
ser iniciado ou reiniciado para este teste.
