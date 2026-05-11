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

import React, { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button, inputClass } from '../../ui';

const TokensFilters = ({
  formInitValues,
  setFormApi,
  searchTokens,
  loading,
  searching,
  t,
}) => {
  const [keyword, setKeyword] = useState(formInitValues?.searchKeyword || '');
  const [token, setToken] = useState(formInitValues?.searchToken || '');

  // Expose a minimal form-like API for parent compatibility
  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      getValues: () => ({ searchKeyword: keyword, searchToken: token }),
      getValue: (field) => {
        if (field === 'searchKeyword') return keyword;
        if (field === 'searchToken') return token;
        return undefined;
      },
      reset: () => {
        setKeyword('');
        setToken('');
      },
    };
  }
  // Keep the ref in sync
  apiRef.current.getValues = () => ({ searchKeyword: keyword, searchToken: token });
  apiRef.current.getValue = (field) => {
    if (field === 'searchKeyword') return keyword;
    if (field === 'searchToken') return token;
    return undefined;
  };
  apiRef.current.reset = () => {
    setKeyword('');
    setToken('');
  };

  // Notify parent of formApi
  React.useEffect(() => {
    setFormApi(apiRef.current);
  }, []);

  const handleReset = () => {
    setKeyword('');
    setToken('');
    setTimeout(() => {
      searchTokens();
    }, 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    searchTokens(1);
  };

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete='off'
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='relative w-full md:w-56'>
          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'>
            <Search size={14} />
          </span>
          <input
            type='text'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('搜索关键字')}
            className={inputClass({ variant: 'admin', size: 'md', className: 'pl-9' })}
          />
        </div>

        <div className='relative w-full md:w-56'>
          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3'>
            <Search size={14} />
          </span>
          <input
            type='text'
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('密钥')}
            className={inputClass({ variant: 'admin', size: 'md', className: 'pl-9' })}
          />
        </div>

        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='submit'
            variant='secondary'
            disabled={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
          >
            {t('查询')}
          </Button>

          <Button
            type='button'
            variant='secondary'
            onClick={handleReset}
            className='flex-1 md:flex-initial md:w-auto'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default TokensFilters;
