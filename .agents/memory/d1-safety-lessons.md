---
name: Cuidados na avaliação D1
description: Limites de autorização e lições de inventário e emulação para a migração do PráticoSys.
---

O inventário para migração deve incluir todas as tabelas e colunas reais,
não apenas as definições do ORM. Preservar dados legados coexistentes,
mesmo quando o código atual não os utiliza; não mesclar aliases nem limpar
históricos por inferência.

**Why:** a avaliação somente leitura encontrou dados legados fora dos
esquemas do aplicativo. Um dump baseado só no ORM perderia parte do banco.

**How to apply:** conferir catálogo e incompatibilidades antes de qualquer
cópia aprovada. Coluna ou tabela desconhecida bloqueia a conversão, em vez
de ser descartada.

Testes locais no D1 não certificam cotas, CPU, memória, desempenho nem a
operação de uma conta Cloudflare remota.

**Why:** o emulador oficial usa workerd/SQLite, mas não reproduz todas as
restrições e condições comerciais do serviço.

**How to apply:** manter um ensaio remoto separado e aprovado antes de
qualquer decisão de trocar o banco publicado.

Na API Miniflare 5, exemplos antigos podem usar opções da versão 4 e exigir
o conversor oficial. Ao carregar Worker compilado fora do diretório de
execução, definir explicitamente a raiz dos módulos.

**Why:** opções antigas foram rejeitadas apesar de ainda constarem nos
exemplos; uma raiz implícita produziu erro nativo de caminho com `..`.

**How to apply:** consultar os tipos da versão instalada, usar o conversor
documentado e alinhar a raiz dos módulos com o diretório do projeto.

O ORM atual não é uma referência confiável da migração D1 inicial já
liberada. Ao evoluir o esquema, preservar o checksum e comparar com o SQL
da versão liberada; diferenças anteriores também precisam de evolução
versionada, não de um novo checksum para a mesma versão.

**Why:** uma coluna adicionada anteriormente ao ORM passou a alterar a
geração da migração inicial e impediu até a inicialização do D1 isolado.

**How to apply:** tratar o SQL liberado como baseline imutável e executar
os testes de compatibilidade ao adicionar qualquer coluna ou tabela.
