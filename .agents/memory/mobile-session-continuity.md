---
name: Continuidade da sessão mobile
description: Uso instalado pelo navegador e distinção entre tela de login e sessão perdida.
---

O usuário já utiliza o acesso mobile do examinador por “Instalar pelo navegador”. Não pressupor que seja necessário criar um APK para preservar o login.

**Why:** o usuário informou que já usa a instalação pelo navegador e que a tela de login reaparece mesmo ao fechar e reabrir imediatamente.

**How to apply:** em problemas de reabertura, distinguir perda de armazenamento, rejeição do token pelo servidor e simples abertura de um atalho salvo na rota de login. Uma tela de login visível não comprova, por si só, que a sessão foi apagada.

Não aumentar a validade das sessões como correção presumida para uma saída imediata, nem tratar falha de rede como sessão inválida. A restauração deve respeitar a origem do site e a validação no servidor.

**Why:** ampliar o prazo não corrige uma rota de entrada incorreta e aumenta o período de exposição do login.

**How to apply:** confirmar a causa e diferenciar teste de navegador com armazenamento restaurado de verificação em uma instalação real no aparelho.
