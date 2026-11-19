import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { marketplaceApi } from '../../../api/resources';
import { getErrorMessage } from '../../../utils/errors';

export function useMarketplaceCart() {
  const [cart, setCart] = useState({ items: [], itemCount: 0, subtotal: 0, currency: 'INR' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const result = await marketplaceApi.cart();
    setCart(result);
    return result;
  }, []);

  useFocusEffect(useCallback(() => {
    load().catch((err) => setError(getErrorMessage(err)));
  }, [load]));

  async function update(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      return await load();
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return { cart, busy, error, setError, load, update };
}
