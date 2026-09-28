---
name: Concorrência nas escalas CFC
description: Limites da pré-checagem e do salvamento por autoescola nas escalas fixas.
---

Cada autoescola deve ter todas as provas geradas num único INSERT, com IDs determinísticos para impedir duplicação da mesma escola e data em gerações simultâneas. Isso evita escalas parciais por erro de inserção, mas não garante, por si só, que duas autoescolas diferentes não reservem o mesmo examinador em execuções concorrentes.

**Why:** Duas pessoas podem consultar disponibilidade antes de qualquer uma gravar; a verificação em memória de cada cliente fica desatualizada. Bloquear duplicação pela chave da autoescola não bloqueia sobreposição entre autoescolas.

**How to apply:** Ao mudar o fluxo de geração, preservar a inserção por lote e evitar apresentar a prévia como reserva definitiva. Para garantir conflitos entre autoescolas sob concorrência, adicionar serialização ou restrição efetiva no banco, abrangendo capacidade diária e horário do examinador. Não confundir segurança de repetição da mesma escola com segurança de alocação concorrente.