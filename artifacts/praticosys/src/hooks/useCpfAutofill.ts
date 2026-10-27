import { useLayoutEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { CpfAutofill } from '../services/cpfAutofill';

export function useCpfAutofill(options: {
  open: boolean; recordId?: string; enabled: boolean; cpf: string; name: string;
  setName: (name: string) => void;
}) {
  const [status, setStatus] = useState('');
  const setName = useRef(options.setName);
  setName.current = options.setName;
  const controller = useRef<CpfAutofill | null>(null);
  if (!controller.current) controller.current = new CpfAutofill(api.lookupCpf, name => setName.current(name), setStatus);
  useLayoutEffect(() => {
    controller.current!.reset(options.cpf, options.name, options.open && options.enabled);
    return () => controller.current!.cancel();
    // Values are initialised only on modal/context changes, never on keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.open, options.recordId]);
  useLayoutEffect(() => {
    controller.current!.setActive(options.open && options.enabled);
  }, [options.open, options.enabled]);
  return { controller: controller.current, status };
}
