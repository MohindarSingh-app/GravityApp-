import { useCallback, useEffect, useState } from 'react';
import { siteApi } from '../api/resources';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/errors';

export function useCompanySites() {
  const { company } = useAuth();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!company || !company.id) {
      setSites([]);
      setError('Create a company before continuing.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await siteApi.list(company.id);
      setSites((data && data.sites) || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { sites, loading, error, reload };
}
