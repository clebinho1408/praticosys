# Política de acesso — PráticoSys

Referência preventiva de 13/11/2026. Produção, usuários reais, Secrets e Neon compartilhado não foram modificados. Não há evidência de ataque informada pelo usuário.

## Fontes e interpretação

As referências são as rotas e controles de `App.tsx`, `Cadastros.tsx`, `RegistryManagement.tsx`, `CFCSchedulingCenter.tsx`, `RequestManager.tsx`, `Settings.tsx` e os controles de edição confirmada já existentes nos handlers. A ausência antiga de bloqueio numa API **não** concede uma permissão. A política compartilhada está em `functions/_access-policy.ts`; ambos os middlewares reconsultam o cadastro pela sessão verificada.

As regras não alteram cadastros, listas de módulos, vínculos ou permissões já armazenados:

- **ADMIN:** gestão integral prevista na interface.
- **SUPERVISOR e OPERATOR:** `allowedModules` ausente, nulo ou `[]` significa todos os módulos operacionais (`cnh`, `cfc`, `pcd`). Lista preenchida restringe a esses módulos; não é completada automaticamente.
- **SUPERVISOR:** cadastros exigem o módulo explícito `cadastro`. `allowedCadastroTabs` nulo/ausente preserva a compatibilidade com todas as abas; `[]` significa nenhuma; lista preenchida libera somente essas abas. Usuários continuam sendo aba exclusiva do administrador.
- **OPERATOR:** não recebe cadastros, configurações ou administração de usuários por causa desta correção.
- **SUPERVISOR e OPERATOR:** `allowedLocationIds` ausente, nulo ou `[]` significa todos os locais; lista preenchida restringe bancas CNH e registros associados. CFC usa o vínculo da autoescola, não inventa um local CNH.
- **CONSULTANT:** leitura operacional transversal já prevista na interface; não se transforma em administrador ou editor. Não existe vínculo individual de propriedade desse perfil no modelo vigente.
- **SCHOOL, EXAMINER e INSTRUCTOR:** precisam de vínculo existente no cadastro atual, não somente um ID na sessão. Vínculo inválido resulta em negação explícita, nunca listagem global.

## Matriz de ações

“Operacional” abaixo inclui solicitações, candidatos, vagas, bancas, escalas e resultados. As validações de estado e de edição confirmada continuam valendo, mesmo para perfis com permissão de módulo.

| Perfil | Leituras operacionais | Criação/edição/exclusão | Cadastros | Configuração, backups, restauração, limpeza e logs |
|---|---|---|---|---|
| Administrador | Todos os módulos e vínculos | Ações existentes, com validação de estado e campos | Todas as abas, inclusive usuários | Permitidos; restauração e limpeza exigem confirmação; limpeza também exige a chave administrativa |
| Supervisor | Módulos e locais configurados | Ações existentes nesses módulos; mantém edição/exclusão confirmada quando já autorizada | Somente módulo `cadastro` explícito e abas configuradas; não gerencia usuários | Negados, pois a interface não concede essas funções |
| Operador | Módulos e locais configurados | Ações operacionais existentes; mantém a restrição já existente para edição/exclusão de prova confirmada | Não recebe novas abas | Negados |
| Consultor | Leitura operacional e relatórios, conforme interface | Negadas | Referências de leitura necessárias aos relatórios | Negados |
| Autoescola | Seus pedidos/vagas/resultados e bancas associadas | Pedidos pendentes próprios, confirmação/cancelamento previstos; não muda autoescola, examinador ou vínculo arbitrariamente | Sua autoescola; referências estritamente associadas aos seus exames | Negados |
| Examinador | Exames designados diretamente ou pelos examinadores da banca; fila CFC compatível com suas categorias | Registrar/retirar o próprio interesse; resultados atribuídos e campos necessários ao fluxo; nunca altera resultado alheio | Referências dos exames vinculados; dados reduzidos | Negados |
| Instrutor | Seus candidatos CNH e bancas relacionadas; bancas comuns abertas necessárias à consulta de disponibilidade | Cadastro/edição/confirmação de seus candidatos nos estados permitidos | Seu cadastro e referências necessárias | Negados |

### Vínculos indiretos e respostas

- A designação de examinador pode vir de `examinerId` do registro ou de `examinerIds` da banca; não se exige vínculo direto inexistente.
- Resultados podem se referir a uma banca ou ao pedido/vaga usado pela interface como identificador de prova.
- O vínculo legado de instrutor suporta os segmentos exatos `Moto: … / Carro: …`, sem busca por substring. Nomes duplicados não concedem propriedade ambígua; a referência por ID continua inequívoca.
- A fila CFC não atribuída do examinador omite identidade do candidato e interesses de outros examinadores. Isso vale tanto para GET quanto para a resposta de registrar/retirar interesse.
- Leituras e mutações usam o mesmo escopo. Alterar o módulo, autoescola ou banca no destino não contorna a verificação da origem.
- Veículos enviados numa edição de instrutor precisam pertencer ao instrutor editado. Campos aceitos são explícitos; campos desconhecidos e atribuições sensíveis indevidas são rejeitados.
- Criação de instrutor pode provisionar **somente uma nova conta vinculada**, com senha temporária aleatória, quando ainda não existe o login. Não substitui credencial de conta existente. Apenas o criador autorizado recebe a credencial na resposta imediata.
- Supervisor pode salvar autoescola/examinador na aba autorizada, sem tentar criar ou redefinir usuário administrativo em seguida. O administrador provisiona o acesso separadamente.

## Superfícies administrativas e exportações

| Superfície | Regra |
|---|---|
| Usuários e redefinição | Administrador; listas não retornam hashes. Criar/redefinir sempre hasheia no servidor e obriga primeiro acesso |
| Configurações | GET autenticado retorna somente campos necessários à interface para não administradores; gravação administrativa; chave de limpeza nunca é retornada a outros perfis |
| Logs CNH | Administrador, como a tela de configurações; autoria vem da sessão; limite padrão 100, máximo 300 e offset limitado |
| Backups | Administrador; download/listagem/criação/restauração protegidos; confirmação explícita na restauração; senhas do snapshot são ignoradas, não substituem hashes atuais |
| Limpeza total/veículos órfãos | Administrador, chave e confirmação `APAGAR DADOS OPERACIONAIS`; tabelas operacionais explícitas e transação, não SQL arbitrário |
| Eventos Express | Assinatura autenticada; não transmite registros ou dados de candidatos no stream; a interface atualiza dados por requisições autenticadas |
| Relatórios, impressão e exportação operacional no navegador | Usam as mesmas coleções já filtradas por perfil, módulo, local e vínculo; não existe exportação alternativa irrestrita |
| Cidades, locais, datas bloqueadas | Leitura autenticada necessária aos fluxos; alteração administrativa, conforme configurações da interface |
| Primeiro acesso obrigatório | Somente autenticação, consulta/encerramento da própria sessão e troca inicial; demais operações aguardam senha válida |

## Credenciais, tentativas e sessões

- Login vazio/nulo, senha armazenada ausente e primeira conta administrativa sem senha não emitem sessão. O login público não “reivindica” a conta inicial.
- Setup exige a credencial de manutenção e senha inicial válida; não é executado automaticamente contra o banco compartilhado. Conta inicial já provisionada não tem a senha substituída. Recuperação cotidiana é feita pelo administrador autenticado com senha temporária; não foi inventado um reset público por e-mail.
- Senhas novas exigem pelo menos 6 caracteres, têm limite de 72 bytes UTF-8, não aceitam hash bcrypt como senha importada e são hasheadas no servidor. A migração legítima de senha legada no login permanece.
- Limites persistem no banco, em janelas de 10 minutos: 10 por rede/login/finalidade e 100 por rede/finalidade, inclusive OTP. Não existe bloqueio permanente ou global por conta. Respostas de credenciais inválidas não revelam existência de conta.
- Pages usa `CF-Connecting-IP` inserido pelo Cloudflare. Express usa a conexão de rede, não aceita `X-Forwarded-For` arbitrário. Atrás de um proxy compartilhado, o limite por rede pode agrupar usuários; ajustar uma cadeia confiável de proxies exige decisão de infraestrutura, não confiar cegamente no cabeçalho.
- OTP continua com hash, prazo, consumo único, limite de falhas e envio obrigatório; não há código de desenvolvimento devolvido ao cliente como alternativa ao e-mail.
- Troca própria exige confirmação, conserva o token atual e revoga somente os outros acessos e OTPs daquela conta. Reset administrativo exige confirmação e revoga os acessos daquela conta. Atualização comum de perfil não revoga sessões.
- As atualizações de senha, sessões e OTPs são atômicas. A duração vigente de oito horas e a restauração do login salvo na PWA foram preservadas. Instalar a correção não encerra todas as sessões.
- Emissão de sessões e desafios compara a credencial ainda vigente e se serializa com a troca de senha. Um login validado antes de um reset não consegue emitir uma sessão atrasada após ele. Consumo concorrente do mesmo OTP emite somente uma sessão.
- Um backup não é mecanismo de recuperação de senha; contas restauradas sem credencial precisam de provisionamento pelo administrador.

## Ensaios e limites

Os testes novos exigem negações e ações legítimas dos sete perfis; os testes observacionais da auditoria original continuam preservados e não são usados como prova de correção. Os ensaios usam somente D1 local e PostgreSQL descartável, com nomes e e-mails fictícios. O Worker compilado é ensaiado com `2024-09-23`, `nodejs_compat` e `cache_option_enabled`, e tráfego externo proibido.

Não se inferiu a configuração real de cada conta a partir de cópias de produção; não se exportaram dados reais para testes. O comportamento das configurações foi comprovado com fixtures explícitas, inclusive listas vazias, aba autorizada versus negada e local autorizado versus negado.
