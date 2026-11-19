import { useCallback, useRef, useState } from 'react';
import { initialSubmitState, submitReducer } from './submitState';

export function useSubmit() {
  const [state, setState] = useState(initialSubmitState);
  const phaseRef = useRef(state.phase);

  const submit = useCallback(async (action) => {
    if (phaseRef.current === 'submitting') return { result: null, error: null };
    const started = submitReducer({ phase: phaseRef.current, error: null, result: null }, { type: 'start' });
    phaseRef.current = started.phase;
    setState(started);
    try {
      const result = await action();
      const success = submitReducer(started, { type: 'success', result });
      phaseRef.current = success.phase;
      setState(success);
      return { result, error: null };
    } catch (error) {
      const failed = submitReducer(started, { type: 'failure', error });
      phaseRef.current = failed.phase;
      setState(failed);
      return { result: null, error };
    }
  }, []);

  const reset = useCallback(() => {
    phaseRef.current = 'idle';
    setState(initialSubmitState);
  }, []);

  return { ...state, submit, reset };
}
