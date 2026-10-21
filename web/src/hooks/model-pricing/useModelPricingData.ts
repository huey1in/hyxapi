/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { filterPricingModels, parsePricingData, sortPricingModels } from '../../features/pricing/catalog-data';
import type { PricingSort } from '../../features/pricing/catalog-data';
import type { PricingModel, TokenUnit } from '../../features/pricing/types';
import { usePricingClock } from '../../features/pricing/DynamicPricingDetails';
import { applyRechargePrice } from '../../features/pricing/lib/pricing-display';

type PricingCurrency = 'USD' | 'CNY' | 'CUSTOM';
export const useModelPricingData = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const account = `${user?.id ?? 'anonymous'}:${sid ?? ''}`;
  const owner = useRef<string | null>(account); owner.current = account;
  useEffect(() => { owner.current = account; return () => { owner.current = null; }; }, [account]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterQuotaType, setFilterQuotaType] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [sortBy, setSortBy] = useState<PricingSort>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [currency, setCurrency] = useState<PricingCurrency>('USD');
  const [tokenUnit, setTokenUnit] = useState<TokenUnit>('M');
  const [showRechargePrice, setShowRechargePrice] = useState(false);
  const pricingNow = usePricingClock();
  const [statusState] = useContext(StatusContext);
  const status = statusState.status;
  const siteDisplayType = status?.quota_display_type || 'USD';
  useEffect(() => { if (siteDisplayType === 'USD' || siteDisplayType === 'CNY' || siteDisplayType === 'CUSTOM') setCurrency(siteDisplayType); }, [siteDisplayType]);
  const query = useQuery({
    queryKey: ['model-pricing', account], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await API.get('/api/pricing', { signal, skipErrorHandler: true, disableDuplicate: true });
      signal.throwIfAborted(); return parsePricingData(response.data);
    },
  });
  const models: PricingModel[] = query.isError ? [] : query.data?.models ?? [];
  const groupRatio: Record<string, number> = query.isError ? {} : query.data?.groupRatio ?? {};
  const usableGroup: Record<string, string> = query.isError ? {} : query.data?.usableGroup ?? {};
  const filteredModels = useMemo(() => sortPricingModels(filterPricingModels(models, { search: searchValue, group: filterGroup, billing: filterQuotaType, vendor: filterVendor }), sortBy, pricingNow), [models, searchValue, filterGroup, filterQuotaType, filterVendor, sortBy, pricingNow]);
  useEffect(() => { setCurrentPage(1); }, [filterGroup, filterQuotaType, filterVendor, searchValue, sortBy]);
  useEffect(() => { setCurrentPage((page) => Math.max(1, Math.min(page, Math.ceil(filteredModels.length / 20) || 1))); }, [filteredModels.length]);
  const displayPrice = useCallback((usdPrice: number): string => {
    const rawRate = currency === 'CNY' ? status?.usd_exchange_rate : currency === 'CUSTOM' ? status?.custom_currency_exchange_rate : 1;
    const rate = typeof rawRate === 'number' && Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 1;
    const customSymbol = typeof status?.custom_currency_symbol === 'string' ? status.custom_currency_symbol : '¤';
    const symbol = currency === 'CNY' ? '¥' : currency === 'CUSTOM' ? customSymbol || '¤' : '$';
    const creditPrice = applyRechargePrice(usdPrice, showRechargePrice, status?.price, status?.usd_exchange_rate);
    return symbol + new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 3, maximumFractionDigits: 12 }).format(creditPrice * rate);
  }, [currency, status?.price, status?.usd_exchange_rate, status?.custom_currency_exchange_rate, status?.custom_currency_symbol, showRechargePrice, i18n.language]);
  const copyText = async (text: string) => {
    const previous = owner.current;
    const copied = await copy(text);
    if (owner.current !== previous || previous === null) return;
    if (copied) showSuccess(t('Copied: {{text}}', { text }));
    else showError(t('Unable to copy to clipboard. Copy the text manually.'));
  };
  return {
    searchValue, handleChange: setSearchValue, selectedGroup, setSelectedGroup, setFilterGroup, filterQuotaType, setFilterQuotaType, filterVendor, setFilterVendor,
    sortBy, setSortBy, pageSize: 20, currentPage, setCurrentPage,
    currency, setCurrency, siteDisplayType, tokenUnit, setTokenUnit, models, loading: query.isPending || query.isFetching,
    error: query.isError, groupRatio, usableGroup, filteredModels, displayPrice, refresh: () => query.refetch(), copyText,
    showRechargePrice, setShowRechargePrice, supportedEndpoints: query.data?.supportedEndpoints ?? {},
    pricingNow, autoGroups: query.isError ? [] : query.data?.autoGroups ?? [],
  };
};
