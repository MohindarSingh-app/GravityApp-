export const initialSubmitState = {
  phase: 'idle',
  error: null,
  result: null,
};

export function submitReducer(state, action) {
  if (action.type === 'start') {
    if (state.phase === 'submitting') return state;
    return { phase: 'submitting', error: null, result: null };
  }
  if (action.type === 'success') {
    if (state.phase !== 'submitting') return state;
    return { phase: 'success', error: null, result: action.result ?? null };
  }
  if (action.type === 'failure') {
    if (state.phase !== 'submitting') return state;
    return { phase: 'error', error: action.error, result: null };
  }
  if (action.type === 'reset') return initialSubmitState;
  return state;
}
