---
name: Validação visual do CSS de produção
description: Como interpretar regressões visuais no site publicado e a decisão de incorporar os estilos principais no HTML.
---

Uma captura da tela de login não valida mudanças no menu autenticado. Para regressões visuais exclusivas da publicação, verificar também o CSS compilado e o componente real nos estados expandido e recolhido, com identidade fictícia isolada.

**Why:** o usuário relatou perda completa do padrão visual depois da mudança de menu recolhível. O CSS publicado retornou 200 e correspondeu ao build local, mas isso não comprovou sua aplicação no navegador do usuário. A prévia de desenvolvimento normal não era evidência suficiente sobre a tela afetada.

**How to apply:** distinguir validade do arquivo, entrega HTTP e aplicação no navegador. Não chamar uma tela autenticada de verificada quando só foi vista a tela de login; remover páginas temporárias de diagnóstico antes de entregar.

Os estilos principais de produção são incorporados ao HTML para eliminar a dependência de uma requisição separada de CSS.

**Why:** manter documento e estilos na mesma resposta reduz o ponto de falha que produz uma página completamente sem formatação. Isso foi uma medida de entrega; a causa específica no navegador original não foi comprovada. O custo é HTML maior e menor reaproveitamento independente do cache de CSS.

**How to apply:** preservar essa decisão ao alterar o build, manter falha explícita para estilos ausentes/vazios e testar o resultado de produção antes de voltar a separar os estilos.
