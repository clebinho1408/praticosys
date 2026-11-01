---
name: Compatibilidade real das consultas no Cloudflare
description: Testes de integrações externas precisam usar a mesma data e flags do ambiente Pages, não só Node ou workerd recente.
---

Validar opções nativas de fetch no runtime Workers usando a data e as
flags efetivamente configuradas no projeto Pages. Testes Node ou workerd
com data mais recente não comprovam compatibilidade com a produção.

**Why:** a consulta CPF passou nos testes simulados e no Node, mas a produção
falhou antes de chamar o provedor: a data antiga não habilitava Request.cache,
e Workers não implementa redirect: error. As exceções apareciam apenas como
uma falha genérica de conexão.

**How to apply:** reproduzir chamadas com outbound interceptado no workerd
e com as opções de produção. Preservar a proteção de cache e rejeitar
redirecionamentos sem encaminhar credenciais; não contornar incompatibilidades
desativando controles de privacidade ou consultando pessoas reais.

Os tipos globais de Request/Response de Node e Workers não são intercambiáveis.
Preservar essa fronteira nos testes que carregam handlers Pages em Node.

**Why:** importar diretamente os tipos Pages em uma suíte Node fez o compilador
exigir propriedades de Workers em respostas Node e rejeitar requisições válidas
do harness. Isso não era uma falha da aplicação no runtime de produção.

**How to apply:** usar o harness de runtime para carregar os handlers, mantendo
os contratos puros compartilhados verificáveis normalmente; não adaptar os
handlers de produção aos tipos globais do ambiente de teste.
