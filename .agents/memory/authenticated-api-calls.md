---
name: Chamadas autenticadas no PráticoSys
description: Regra para evitar que telas percam dados ao consultar rotas protegidas sem o token de sessão
---

Rotas protegidas do PráticoSys devem ser acessadas pelo serviço central de API, nunca por `fetch` direto.

**Why:** Chamadas diretas não incluem o token de sessão. Quando a tela transforma respostas não bem-sucedidas em arrays vazios, um 401 parece ausência legítima de dados e regras dependentes desses dados deixam de funcionar.

**How to apply:** Ao carregar dados usados por mais de uma tela, reutilize o método autenticado correspondente e deixe erros reais chegarem ao tratamento de erro da tela.