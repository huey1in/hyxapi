import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { API, showError } from '../../helpers';
import { UserContext } from '../../context/User';
import { useLoginModal } from '../../context/LoginModal';
import { Button } from '../../components/ui';

const FEATURES = [
  { num: '01', title: '智能路由', desc: '自动选择最优渠道，按延迟、成功率与价格动态调度。' },
  { num: '02', title: '统一计费', desc: '多账户、多渠道汇总记账，按实际 token 透明结算。' },
  { num: '03', title: '协议兼容', desc: '完全兼容 OpenAI / Anthropic / Gemini 等原生 SDK，零迁移成本。' },
];

const VENDORS = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Mistral', 'Cohere', 'xAI', 'Qwen', 'Moonshot', 'Zhipu'];

const Home = () => {
  const navigate = useNavigate();
  const { userState } = useContext(UserContext);
  const { openLoginModal } = useLoginModal();
  const [content, setContent] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/home_page_content');
        const { success, data } = res.data || {};
        if (success && data) setContent(data);
      } catch (e) {
        // silent
      }
    })();
  }, []);

  const handleStart = () => {
    if (userState?.user) navigate('/console');
    else openLoginModal?.();
  };

  if (content && content.startsWith('https://')) {
    return <iframe src={content} className='w-full h-screen border-none' title='home' />;
  }
  if (content) {
    return <div className='w-full overflow-x-hidden' dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return (
    <div className='w-full overflow-x-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
      <section className='border-b border-ui-border min-h-[calc(100vh-64px)] flex items-center'>
        <div className='max-w-6xl mx-auto px-6 py-20 w-full'>
          <p className='font-mono text-sm text-ui-text-3 mb-6 tracking-wide'>// less plumbing, more product</p>
          <h1 className='text-5xl md:text-7xl font-bold text-ui-text-1 leading-[1.05] mb-6 tracking-tight'>
            Build something<br />
            <span style={{ color: 'var(--ui-accent)' }}>great!</span>
          </h1>
          <p className='text-lg md:text-xl text-ui-text-2 max-w-xl mb-10 leading-relaxed'>
            兼容 OpenAI / Claude / Gemini 等协议，智能路由，统一计费。
          </p>
          <div className='flex flex-wrap items-center gap-3'>
            <Button size='lg' onClick={handleStart}>
              免费开始 <ArrowRight size={18} className='ml-1' />
            </Button>
            <Button size='lg' variant='toggle' onClick={() => navigate('/pricing')}>查看定价</Button>
          </div>
        </div>
      </section>

      <section className='border-b border-ui-border py-14'>
        <div className='max-w-6xl mx-auto px-6'>
          <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-6 text-center'>
            支持主流模型提供商
          </p>
          <div className='flex flex-wrap items-center justify-center gap-x-10 gap-y-4'>
            {VENDORS.map((v) => (
              <span key={v} className='text-base md:text-lg font-semibold text-ui-text-2'>{v}</span>
            ))}
          </div>
        </div>
      </section>

      <section className='px-6 py-24'>
        <div className='max-w-6xl mx-auto'>
          <div className='mb-14 max-w-3xl'>
            <p className='font-mono text-xs text-ui-text-3 tracking-widest uppercase mb-3'>// 为什么选择我们</p>
            <h2 className='text-4xl md:text-5xl font-bold text-ui-text-1 tracking-tight'>
              企业级 <span style={{ color: 'var(--ui-accent)' }}>AI</span> 网关
            </h2>
            <p className='mt-5 text-lg text-ui-text-2'>
              一个 API，兼容所有顶级大模型。智能路由、统一计费、毫秒级响应。
            </p>
          </div>
          <div className='grid md:grid-cols-3 gap-px bg-ui-border rounded-3xl overflow-hidden border border-ui-border'>
            {FEATURES.map((f) => (
              <div key={f.num} className='p-8 md:p-10' style={{ backgroundColor: 'var(--page-bg)' }}>
                <span className='font-mono text-xs text-ui-text-3 tracking-widest'>{f.num}</span>
                <h3 className='mt-6 text-2xl font-bold text-ui-text-1 mb-3 tracking-tight'>{f.title}</h3>
                <p className='text-ui-text-2 leading-relaxed'>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
