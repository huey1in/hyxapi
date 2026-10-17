import Card from './Card';
import Button from '../button/Button';

export default { title: 'UI/Card', component: Card };

const Row = ({ title, children }) => (
  <div className='mb-5'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

export const AllVariants = () => (
  <div className='max-w-[900px] space-y-3'>
    <Row title='variant'>
      <div className='grid grid-cols-2 gap-3'>
        <Card>plain (与 page-bg 同色 + 边框，默认)</Card>
        <Card variant='filled'>filled (bg-ui-bg-subtle 实心)</Card>
      </div>
    </Row>
    <Row title='header / footer slot'>
      <Card
        header={<div className='text-sm font-semibold text-ui-text'>标题</div>}
        footer={
          <div className='flex justify-end gap-2'>
            <Button size='sm'>取消</Button>
            <Button size='sm'>确认</Button>
          </div>
        }
      >
        <p className='text-sm text-ui-text-2'>这里是卡片主体内容。Header / Footer 自带分隔线和 padding。</p>
      </Card>
    </Row>
    <Row title='interactive'>
      <div className='grid grid-cols-2 gap-3'>
        <Card interactive='hover' onClick={() => alert('clicked')}>
          interactive='hover'
        </Card>
        <Card interactive='lift' onClick={() => alert('clicked')}>
          interactive='lift' (带 shadow-md)
        </Card>
      </div>
    </Row>
  </div>
);