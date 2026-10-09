# Avaliação e preparação Neon → Cloudflare D1

## Situação e limites desta entrega

Objetivo informado: **centralizar os serviços na Cloudflare**.

A prévia usa D1 **local**, no emulador oficial Miniflare/workerd, com dados
fictícios. O banco do site publicado continua no Neon. Não foram criados
recursos remotos, copiados registros reais, publicados arquivos, enviados
e-mails reais ou executadas migrações/gravações no Neon.

Existe um caminho D1 opt-in para as Pages Functions. O Express original e o
Neon permanecem disponíveis. D1 é SQLite: não aceita uma conexão PostgreSQL.
As consultas existentes usam um adaptador restrito e testado para SQL,
JSON, booleanos, datas e resultados. Isto **não** é um emulador PostgreSQL
genérico; consultas novas exigem verificação no D1.

### Inventário autorizado, somente leitura — 09/10/2026

- Conexão externa já usada pelo aplicativo, priorizando DATA_BASE_NEON.
- Tamanho físico PostgreSQL: **21.250.048 bytes**, aproximadamente **20,3 MiB**.
- 15 backups armazenados; maior linha JSON medida: **2.390.922 bytes**.
  O tamanho físico PostgreSQL não representa o tamanho final SQLite.
- Foram encontrados dados legados coexistentes: tabela `sessions`, colunas
  antigas de categorias/limites/localização/ano, hashes de CPF e configurações
  antigas. O esquema D1 os preserva separadamente; não mescla nem descarta.
- A consulta agregada não encontrou sobreposições de examinador/data/hora
  entre vagas CFC não canceladas. Isso não substitui validação de capacidade
  diária, vínculos órfãos e regras sobre todos os dados em uma cópia aprovada.
- O inventário detalhado, sem registros/credenciais, fica em
  `.local/d1-assessment.json`. Não é um dump de dados.

Fontes oficiais:
- [Limites D1](https://developers.cloudflare.com/d1/platform/limits/)
- [Transações batch](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Desenvolvimento local](https://developers.cloudflare.com/d1/build-with-d1/local-development/)
- [Limites Workers](https://developers.cloudflare.com/workers/platform/limits/)

D1: 2.000.000 bytes por linha/string/BLOB; 100 parâmetros e 100 KB por SQL;
50 consultas por invocação no plano gratuito e 1.000 no pago; banco de até
500 MB gratuito/10 GB pago. Conferir plano e documentação novamente antes
da implantação. CPU, memória, custos e desempenho remotos **não foram
medidos**; autenticação bcrypt e restauração exigem ensaio no plano escolhido.

## Prévia isolada e contas fictícias

```sh
pnpm --filter @workspace/scripts run d1:preview
```

Reiniciar o workflow gerenciado `artifacts/api-server: API Server`.
Ele mantém a mesma porta/rota `/api`, mas executa as Pages Functions com
o binding D1 local. O frontend não acessa credenciais administrativas.
O arquivo `.local/d1-preview-enabled` só seleciona o modo de desenvolvimento;
**não altera o Cloudflare nem o banco publicado**.

Contas exclusivamente de teste:
`d1.admin`, `d1.supervisor`, `d1.operator`, `d1.school`,
`d1.examiner`, `d1.instructor`. Senha fictícia: `D1-teste-2026!`.
O nome do órgão cadastrado indica **AMBIENTE D1 — DADOS FICTÍCIOS**.
Sessões anteriores da prévia Neon não são válidas nesse banco isolado.
Resend e consultas externas não recebem as credenciais existentes.
O teste automatizado simula 2FA; a prévia não envia e-mail real.

Dados locais persistem em `.local/d1-state`; não estão no Git nem no deploy.
Para voltar a selecionar a prévia original:

```sh
pnpm --filter @workspace/scripts run d1:preview --disable
```

O reinício posterior volta ao Express original. **Atenção:** esse backend
possui suas próprias rotinas antigas de migração na inicialização e pode
compartilhar o Neon usado pelo site; não o utilize como banco descartável.

## Esquema, versões e atomicidade

`db/d1-schema.ts` gera a versão inicial e mantém checksum congelado.
Migração aplicada alterada ou destino preexistente sem versão são recusados.
Alterações posteriores precisam de nova versão e DDL SQLite explicitamente
revisado; nunca trocar apenas o checksum, reescrever a primeira migração ou
executar setup legado PostgreSQL no D1.

```sh
pnpm --filter @workspace/scripts run d1:schema
```

Gera `generated-artifacts/d1/0001_initial.sql`, sem acessar bancos.
O SQL gerado destina-se a inicialização de um **D1 novo e isolado**.
Preferir o executor versionado para repetição e conferência de checksum.
Em produção futura: `DB_PROVIDER=d1` e binding `DB`; ausência de binding ou
provedor inválido falham explicitamente, sem fallback para Neon.

Movimentação entre módulos usa batch atômico: colisões não apagam o registro
original. Criação de escalas possui guardas de concorrência para o mesmo
examinador/horário e capacidade diária. Atualizar outros campos de um
registro histórico não equivale a alocar uma nova prova.

O importador é exclusivo de **staging local** e restaura guardas no final.
Históricos são preservados mesmo se superarem configurações atuais.
Não remover provas antigas/confirmadas para “corrigir” limites.

## Exportação completa, importação e integridade

**Backup administrativo não é exportação completa de migração**:
omite senhas, sessões, OTPs e auditoria. A ferramenta completa inclui todas
as tabelas públicas, inclusive as legadas. Campo/tabela desconhecidos causam
erro explícito; não são descartados.

Primeiro ensaio, só com dados fictícios:

```sh
pnpm --filter @workspace/scripts run d1:migrate create-fixture .local/d1-fictional-full.json
pnpm --filter @workspace/scripts run d1:migrate import-local .local/d1-fictional-full.json
pnpm --filter @workspace/scripts run d1:migrate verify-local .local/d1-fictional-full.json
# Repetir o MESMO arquivo testa idempotência, sem duplicar IDs.
pnpm --filter @workspace/scripts run d1:migrate import-local .local/d1-fictional-full.json
```

Usar `--state=.local/outro-ensaio-d1` para outro destino isolado.
O padrão é `.local/d1-transfer-state`, separado da prévia com dados fictícios.
Um destino não vazio sem registro de importação, ou outra origem no mesmo
destino, é recusado. A importação valida o arquivo inteiro antes de gravar;
executa lotes de até 8 instruções. **Não é uma transação de todo o banco**.
Interrupção deixa a cópia de staging incompleta; repetir o mesmo arquivo
retoma por upsert. O relatório precisa passar antes de qualquer uso/cutover.

Relatórios: `.local/d1-transfer-report.json` e `integrity.json` no diretório
do ensaio. Comparam contagens, IDs/conteúdo por SHA-256, JSON, booleanos,
datas com precisão preservada, distribuição de módulos/status/histórico,
vínculos e quantidade de órfãos na origem/destino. Backups conferem payload,
identificador, data, gatilho e tamanho original; tamanho físico convertido
e checksum ficam em metadados separados. Órfão já presente na origem é
registrado, não apagado: a igualdade não significa que ele é aceitável.

Exportação real existe, mas **não foi executada** e exige autorização
específica para leitura de registros/cópia de dados pessoais:

```sh
# SOMENTE após aprovação explícita; nunca executar automaticamente:
pnpm --filter @workspace/scripts run d1:migrate export-neon .local/exportacao-aprovada.json --approved-real-data-export
```

Usa transação READ ONLY/REPEATABLE READ para a cópia; não executa setup.
Não imprimir dumps, senhas, tokens, sessões ou registros pessoais.
Arquivos ficam em `.local`, com permissão 0600 e fora de Git/deploy.
Preservar valores cifrados/hashes como estão e garantir disponibilidade das
mesmas chaves pelos mecanismos de secrets — nunca recriptografar, imprimir
ou salvar chaves no relatório. Proteger e eliminar cópias somente após
aprovação da política de retenção. Não usar esta ferramenta para importar
diretamente no banco ativo.

## Backups D1

Snapshots manuais/automáticos continuam exclusivos do administrador.
São lidos consistentemente e armazenados em partes UTF-8 de até 900 KB,
abaixo do limite por linha. Há retenção de 15, unicidade do automático diário,
checksum SHA-256 e validação de partes/tamanho; erros de leitura nunca viram
tabelas vazias. IDs e snapshots históricos são mantidos na importação.

Restauração usa **um batch atômico**, inclusive a suspensão e reinstalação
das guardas de alocação para preservar o histórico. Outras gravações não
podem intercalar esse intervalo. Senhas ausentes no backup administrativo
não são apagadas/substituídas. Como antes, restaura por upsert, não apaga
automaticamente registros ausentes.

Limites conservadores desta implementação: snapshot/restauração de até
8 MB e restauração com até 40 instruções, incluindo guardas. Acima disso,
falha antes de alterar dados. R2 não foi configurado: volumes medidos cabem
nas partes atuais. Reavaliar R2/processamento dedicado se esses limites
forem excedidos ou se ensaios remotos mostrarem limite de CPU/memória.

## Verificação realizada

```sh
pnpm --filter @workspace/scripts run test:d1
pnpm --filter @workspace/scripts run test:d1-edge
pnpm --filter @workspace/scripts run test:backup-restore
pnpm run typecheck
```

A suíte D1 testa contratos/perfis, três módulos, CRUD fictício, edição de
rodízio, pedidos extras/provas confirmadas, bloqueios de permissão, colisão
entre módulos, concorrência, rollback, datas/JSON/booleanos, backup maior
que 2 MB, Unicode, restauração, preservação de senhas, logout e 2FA simulada.
O teste edge executa o Worker Pages compilado em workerd com D1 local.
Isso não certifica desempenho/cotas de uma conta Cloudflare remota.

## Próxima etapa: staging remoto (aprovação separada)

1. Autorizar conta/recursos Cloudflare e criar projeto Pages/D1 de **staging**
   separado; não reutilizar banco, projeto, domínio ou secrets de produção.
2. Usar `wrangler.d1-staging.toml.example` como modelo, preenchendo o ID aprovado.
   Não sobrescrever `wrangler.toml`. O arquivo é exemplo, não uma configuração
   ativa nem autorização para publicar.
3. Inicializar versão/checksum no banco vazio; validar com dados fictícios
   os mesmos perfis/fluxos. Medir CPU, memória, leitura/gravação, concorrência,
   latência, limites e restauração no plano efetivo.
4. Somente com outra autorização, copiar dados reais de maneira protegida,
   conferir relatório completo e tratar bloqueadores sem apagar históricos.
5. Definir operação/retention de backups, limite de crescimento, eventual R2,
   e testes de e-mail 2FA sem enviar mensagens não autorizadas.

## Troca futura e retorno seguro

**Não executar nesta entrega.**

1. Aprovar capacidade, staging, esquema, relatório, perfis e experiência do
   usuário; nenhuma divergência de IDs, JSON, vínculos ou módulos pode ficar
   inexplicada. Validar restauração do backup, não apenas sua criação.
2. Planejar janela e congelar todas as novas gravações, incluindo escalas,
   automações e acesso paralelo pela prévia. Avisar usuários.
3. Fazer exportação completa final do Neon e cópia de recuperação protegida.
   Importar em D1 novo validado; comparar novamente contagens, conteúdo,
   vínculos, históricos, credenciais preservadas e módulos.
4. Só após aprovação explícita, apontar Pages para D1, configurar secrets
   pela ferramenta adequada e publicar. Não excluir o Neon.
5. Antes de liberar gravações, testar login/2FA, cada perfil, cadastros,
   agendamentos, bancas, resultados, escalas e restauração no ambiente final.
6. Manter trilha completa das alterações após o cutover. Sem ela, o rollback
   deixa de ser apenas uma alteração de conexão.
7. Se houver falha **antes** de novas gravações, reconectar ao Neon original
   congelado, após aprovação. Se houver gravações **depois**, congelar ambos,
   exportar as diferenças completas do D1 e reconciliar inserts/updates,
   exclusões, relações, auditoria, sessões e conflitos com o Neon antes de
   reabrir. Não reconectar simplesmente a uma cópia antiga, perdendo registros.
   Essa reconciliação inversa precisa de ensaio e aprovação próprios.
