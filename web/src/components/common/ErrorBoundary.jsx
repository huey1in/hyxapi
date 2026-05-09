import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { withTranslation } from 'react-i18next';

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
          <button
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
            onClick={() => window.location.reload()}
          >
            {t('刷新页面')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
