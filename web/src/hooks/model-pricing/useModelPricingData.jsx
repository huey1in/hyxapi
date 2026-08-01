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

import { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../helpers';
import { StatusContext } from '../../context/Status';

export const useModelPricingData = (previewModels = null) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all'); // 用于 Table 的可用分组筛选，"all" 表示不过滤
  const [filterQuotaType, setFilterQuotaType] = useState('all'); // 'all' | 'tokens' | 'request'
  const [filterVendor, setFilterVendor] = useState('all'); // 供应商筛选: 'all' | 'unknown' | string
  const [currentPage, setCurrentPage] = useState(1);
  const [currency, setCurrency] = useState('USD');
  const [models, setModels] = useState(previewModels || []);
  const [loading, setLoading] = useState(!previewModels);
  const [groupRatio, setGroupRatio] = useState(previewModels ? { default: 1, production: 1 } : {});
  const [usableGroup, setUsableGroup] = useState(previewModels ? { default: '默认分组', production: '生产环境' } : {});
  const pageSize = 20;
  const tokenUnit = 'M';

  const [statusState] = useContext(StatusContext);

  const usdExchangeRate = useMemo(
    () => statusState?.status?.usd_exchange_rate ?? 1,
    [statusState],
  );
  const customExchangeRate = useMemo(
    () => statusState?.status?.custom_currency_exchange_rate ?? 1,
    [statusState],
  );
  const customCurrencySymbol = useMemo(
    () => statusState?.status?.custom_currency_symbol ?? '¤',
    [statusState],
  );

  // 默认货币与站点展示类型同步；TOKENS 由视图层走倍率展示
  const siteDisplayType = useMemo(
    () => statusState?.status?.quota_display_type || 'USD',
    [statusState],
  );
  useEffect(() => {
    if (
      siteDisplayType === 'USD' ||
      siteDisplayType === 'CNY' ||
      siteDisplayType === 'CUSTOM'
    ) {
      setCurrency(siteDisplayType);
    }
  }, [siteDisplayType]);

  const filteredModels = useMemo(() => {
    let result = models;

    // 分组筛选
    if (filterGroup !== 'all') {
      result = result.filter((model) =>
        model.enable_groups.includes(filterGroup),
      );
    }

    // 计费类型筛选
    if (filterQuotaType !== 'all') {
      result = result.filter((model) => model.billing_type === filterQuotaType);
    }

    // 供应商筛选
    if (filterVendor !== 'all') {
      if (filterVendor === 'unknown') {
        result = result.filter((model) => !model.vendor_name);
      } else {
        result = result.filter((model) => model.vendor_name === filterVendor);
      }
    }

    // 搜索筛选
    if (searchValue.length > 0) {
      const searchTerm = searchValue.toLowerCase();
      result = result.filter(
        (model) =>
          (model.model_name &&
            model.model_name.toLowerCase().includes(searchTerm)) ||
          (model.description &&
            model.description.toLowerCase().includes(searchTerm)) ||
          (model.tags && model.tags.toLowerCase().includes(searchTerm)) ||
          (model.vendor_name &&
            model.vendor_name.toLowerCase().includes(searchTerm)),
      );
    }

    return result;
  }, [
    models,
    searchValue,
    filterGroup,
    filterQuotaType,
    filterVendor,
  ]);

  const displayPrice = (usdPrice) => {
    const priceInUSD = usdPrice;

    if (currency === 'CNY') {
      return `¥${(priceInUSD * usdExchangeRate).toFixed(3)}`;
    } else if (currency === 'CUSTOM') {
      return `${customCurrencySymbol}${(priceInUSD * customExchangeRate).toFixed(3)}`;
    }
    return `$${priceInUSD.toFixed(3)}`;
  };

  const setModelsFormat = (models, vendorMap) => {
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      m.key = m.model_name;
      // The backend enum is numeric internally; expose the stable public
      // labels used by the pricing UI.
      if (m.billing_type === 0) m.billing_type = 'tokens';
      if (m.billing_type === 1) m.billing_type = 'request';

      if (m.vendor_id && vendorMap[m.vendor_id]) {
        const vendor = vendorMap[m.vendor_id];
        m.vendor_name = vendor.name;
        m.vendor_icon = vendor.icon;
        m.vendor_description = vendor.description;
      }
    }
    models.sort((a, b) => {
      if (a.model_name.startsWith('gpt') && !b.model_name.startsWith('gpt')) {
        return -1;
      } else if (
        !a.model_name.startsWith('gpt') &&
        b.model_name.startsWith('gpt')
      ) {
        return 1;
      } else {
        return a.model_name.localeCompare(b.model_name);
      }
    });

    setModels(models);
  };

  const loadPricing = async () => {
    setLoading(true);
    const res = await API.get('/api/pricing');
    const {
      success,
      message,
      data,
      vendors,
      group_ratio,
      usable_group,
    } = res.data;
    if (success) {
      setGroupRatio(group_ratio);
      setUsableGroup(usable_group);
      setSelectedGroup('all');
      // 构建供应商 Map 方便查找
      const vendorMap = {};
      if (Array.isArray(vendors)) {
        vendors.forEach((v) => {
          vendorMap[v.id] = v;
        });
      }
      setModelsFormat(data, vendorMap);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const refresh = async () => {
    await loadPricing();
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      showError(t('无法复制到剪贴板，请手动复制') + ': ' + text);
    }
  };

  const handleChange = (value) => {
    const newSearchValue = value ? value : '';
    setSearchValue(newSearchValue);
  };

  useEffect(() => {
    if (previewModels) return undefined;
    refresh().then();
  }, [previewModels]);

  // 当筛选条件变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterGroup,
    filterQuotaType,
    filterVendor,
    searchValue,
  ]);

  return {
    searchValue,
    selectedGroup,
    setSelectedGroup,
    setFilterGroup,
    filterQuotaType,
    setFilterQuotaType,
    filterVendor,
    setFilterVendor,
    pageSize,
    currentPage,
    setCurrentPage,
    currency,
    setCurrency,
    siteDisplayType,
    tokenUnit,
    models,
    loading,
    groupRatio,
    usableGroup,
    filteredModels,
    displayPrice,
    refresh,
    copyText,
    handleChange,
  };
};
