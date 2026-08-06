import { useToast as _useToast } from 'primevue/usetoast';

const DEFAULT_LIFE = 4000;
const DEDUP_WINDOW = 2000; // ms — ignora toasts idénticos dentro de esta ventana

const _seen = new Map(); // key → timestamp

export function useToast() {
    const _toast = _useToast();

    const add = (opts) => {
        const key = `${opts.severity}::${opts.summary ?? ''}::${opts.detail ?? ''}`;
        const now = Date.now();
        const last = _seen.get(key);

        if (last && now - last < DEDUP_WINDOW) return; // duplicado reciente, ignorar
        _seen.set(key, now);

        _toast.add({
            life: DEFAULT_LIFE,
            ...opts, // life en opts sobreescribe el default si viene explícito
        });
    };

    const removeAllGroups = _toast.removeAllGroups;
    const removeGroup     = _toast.removeGroup;
    const remove          = _toast.remove;

    return { add, removeAllGroups, removeGroup, remove };
}
