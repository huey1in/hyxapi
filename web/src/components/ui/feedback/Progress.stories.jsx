import { useState, useEffect } from 'react';
import Progress from './Progress';
import Button from '../button/Button';

export default { title: 'UI/Progress', component: Progress };

const Row = ({ title, children }) => (
  <div className='mb-5'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

export const AllVariants = () => {
  const [v, setV] = useState(35);
  useEffect(() => {
    const t = setInterval(() => setV((x) => (x >= 100 ? 0 : x + 5)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className='max-w-[600px] space-y-6'>
      <Row title='linear (固定值)'>
        <div className='space-y-3'>
          <Progress value={25} showLabel />
          <Progress value={60} tone='success' showLabel />
          <Progress value={80} tone='warning' showLabel />
          <Progress value={95} tone='danger' showLabel />
        </div>
      </Row>
      <Row title='linear (动态)'>
        <Progress value={v} showLabel />
      </Row>
      <Row title='linear (不定)'>
        <Progress indeterminate />
      </Row>
      <Row title='circular'>
        <div className='flex items-center gap-6'>
          <Progress variant='circular' value={v} showLabel />
          <Progress variant='circular' value={75} tone='success' size={64} thickness={6} showLabel />
          <Progress variant='circular' indeterminate />
        </div>
      </Row>
      <Row title='控制'>
        <div className='flex items-center gap-2'>
          <Button onClick={() => setV(Math.max(0, v - 10))}>-10</Button>
          <Button onClick={() => setV(Math.min(100, v + 10))}>+10</Button>
        </div>
      </Row>
    </div>
  );
};
