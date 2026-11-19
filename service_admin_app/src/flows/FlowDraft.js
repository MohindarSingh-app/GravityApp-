import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const FlowDraftContext = createContext(null);

export function FlowDraftProvider({ children }) {
  const [draft, setDraft] = useState({});
  const patch = useCallback((partial) => {
    setDraft((current) => ({ ...current, ...partial }));
  }, []);
  const clear = useCallback(() => setDraft({}), []);
  const value = useMemo(() => ({ draft, patch, clear }), [draft, patch, clear]);
  return (
    <FlowDraftContext.Provider value={value}>
      {children}
    </FlowDraftContext.Provider>
  );
}

export function useFlowDraft() {
  const value = useContext(FlowDraftContext);
  if (!value) {
    throw new Error('useFlowDraft must be used within FlowDraftProvider.');
  }
  return value;
}
