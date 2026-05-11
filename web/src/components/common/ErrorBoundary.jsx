import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { withTranslation } from 'react-i18next';
import { Button } from '../ui';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div className='flex flex-col justify-center items-center h-screen p-8'>
          <AlertTriangle size={64} className='text-gray-400 mb-4' />
          <p className='text-lg text-gray-600 mb-4'>
            {t('页面渲染出错，请刷新页面重试')}
          </p>
          <Button variant='primary' onClick={() => window.location.reload()}>
            {t('刷新页面')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
