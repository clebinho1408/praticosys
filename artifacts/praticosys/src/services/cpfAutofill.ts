// Per-modal controller: no persistent CPF/name cache and no paid retries.
export const cleanCpf = (value: string) => value.replace(/\D/g, '').slice(0, 11);
export const cleanCandidateName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
export function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let n = 9; n <= 10; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(cpf[i]) * (n + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(cpf[n])) return false;
  }
  return true;
}
export class CpfAutofill {
  private cpf = '';
  private name = '';
  private automaticName: string | null = null;
  private revision = 0;
  private active = false;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  constructor(
    private lookup: (cpf: string, signal: AbortSignal) => Promise<{ name: string }>,
    private setName: (name: string) => void,
    private setStatus: (status: string) => void,
    private delay = 450,
  ) {}
  cancel() { this.revision++; clearTimeout(this.timer); this.abort?.abort(); }
  setActive(active: boolean) { this.cancel(); this.active = active; this.setStatus(''); }
  reset(cpf: string, name: string, active: boolean) {
    this.cancel(); this.cpf = cleanCpf(cpf); this.name = name;
    this.automaticName = null; this.active = active; this.setStatus('');
  }
  manualName(name: string) {
    this.cancel(); this.name = name; this.automaticName = null; this.setStatus('');
  }
  changeCpf(value: string) {
    const cpf = cleanCpf(value);
    if (this.cpf === cpf) return;
    this.cancel(); this.cpf = cpf; this.setStatus('');
    if (this.automaticName !== null && this.name === this.automaticName) {
      this.name = ''; this.setName('');
    }
    this.automaticName = null;
    if (!this.active || cpf.length !== 11) return;
    if (!isValidCpf(cpf)) { this.setStatus('CPF inválido. Confira os dígitos; o nome pode ser preenchido manualmente.'); return; }
    const revision = this.revision;
    this.timer = setTimeout(async () => {
      const controller = new AbortController(); this.abort = controller;
      this.setStatus('Consultando nome pelo CPF…');
      try {
        const result = await this.lookup(cpf, controller.signal);
        if (revision !== this.revision || controller.signal.aborted) return;
        this.name = cleanCandidateName(result.name); this.automaticName = this.name;
        this.setName(this.name); this.setStatus('Nome preenchido pelo CPF. Você pode editar ou apagar.');
      } catch (e) {
        if (revision !== this.revision || controller.signal.aborted) return;
        this.setStatus(e instanceof TypeError
          ? 'Não foi possível conectar ao servidor. Preencha o nome manualmente.'
          : e instanceof Error ? e.message : 'Consulta indisponível. Preencha o nome manualmente.');
      }
    }, this.delay);
  }
}
