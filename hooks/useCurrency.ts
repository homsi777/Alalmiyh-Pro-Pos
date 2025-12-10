
import { useCallback } from 'react';
import useGlobalStore from '../store/useGlobalStore';
import { Currency, Price } from '../types';
import { CURRENCY_INFO } from '../constants';

export const useCurrency = () => {
  const { exchangeRates } = useGlobalStore();

  const convertToSyp = useCallback((price: Price): number => {
    if (price.currency === Currency.SYP) {
      return price.amount;
    }
    if (price.currency === Currency.USD) {
      return price.amount * exchangeRates.USD;
    }
    if (price.currency === Currency.TRY) {
      return price.amount * exchangeRates.TRY;
    }
    return price.amount;
  }, [exchangeRates]);
  
  const convertFromSyp = useCallback((sypAmount: number, targetCurrency: Currency): number => {
    if (targetCurrency === Currency.SYP) {
      return sypAmount;
    }
    if (targetCurrency === Currency.USD) {
      return sypAmount / exchangeRates.USD;
    }
    if (targetCurrency === Currency.TRY) {
      return sypAmount / exchangeRates.TRY;
    }
    return sypAmount;
  }, [exchangeRates]);


  const formatCurrency = useCallback((amount: number, currency: Currency) => {
    return new Intl.NumberFormat('ar-SY', {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  }, []);
  
  const getCurrencySymbol = (currency: Currency) => {
    return CURRENCY_INFO[currency].symbol;
  };

  return { convertToSyp, convertFromSyp, formatCurrency, getCurrencySymbol };
};
