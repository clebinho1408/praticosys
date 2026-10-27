# Nome pelo CPF — CNH do Brasil

O serviço começa desativado. Em **Configurações → CNH do Brasil →
Autopreenchimento**, o administrador pode ativá-lo e salvar a preferência.
O campo Nome Completo permanece manualmente editável.

## Credencial

Defina `APICPF_API_KEY` como segredo no ambiente que executa a API:
o servidor Express ou o ambiente das Pages Functions. Nunca use variáveis
`VITE_*`, o formulário de configurações do aplicativo ou arquivos versionados
para guardar a chave. A chave enviada no anexo original deve ser substituída.
Não publique, altere o banco compartilhado ou ative o serviço como parte dos
testes locais.

A prévia D1 isolada aceita somente essa credencial específica para esta
integração; outros segredos de serviços externos continuam excluídos.
Os testes automatizados usam chaves fictícias e respostas simuladas.
Sem chave, a tentativa exibe uma mensagem de configuração e mantém a
entrada manual disponível.

## Funcionamento e segurança

- Consulta apenas ao alterar um CPF válido em Candidatos do módulo CNH.
- Abertura de cadastro existente não dispara consulta.
- Debounce de 450 ms; nenhuma repetição automática de chamadas cobradas.
- Até 10 tentativas por minuto por usuário, contabilizadas atomicamente.
- Timeout de 8 segundos; CPF, resposta e chave não são registrados em logs.
- Somente o nome retorna ao navegador; não há cache persistente de CPFs.
- Alterar o nome manualmente, fechar o modal ou trocar o cadastro cancela
  a aplicação de respostas pendentes.

## Evolução de banco

A preferência e o contador de uso têm evolução aditiva no Neon, preparada
nos dois backends. Ela não foi aplicada ao Neon compartilhado durante
a implementação.

No D1, o checksum da migração inicial permanece intacto. A manutenção
explícita aplica a nova versão antes de atender requisições; requisições
não executam DDL. O comando `pnpm --filter @workspace/scripts d1:schema`
gera arquivos SQL separados em `generated-artifacts/d1`, sem alterar bancos.
Não reaplique `0001_initial.sql` para atualizar uma base existente.

## Verificação sem custos externos

`pnpm --filter @workspace/scripts test:cpf-autofill`

Executa o controlador do formulário, os erros do provedor, permissões,
persistência e concorrência da cota em D1 efêmero. Não envia CPFs ao provedor,
não consome créditos e não conecta ao Neon.
