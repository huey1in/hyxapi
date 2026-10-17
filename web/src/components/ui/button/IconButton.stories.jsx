import { Plus, X, Search, Trash2, Edit2, MoreHorizontal, RefreshCw } from 'lucide-react';
import IconButton from './IconButton';

export default {
  title: 'UI/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
};

const Row = ({ title, children }) => (
  <div className='mb-4'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    <div className='flex flex-wrap items-center gap-2'>{children}</div>
  </div>
);

export const AllVariants = () => (
  <div className='min-w-[640px] space-y-2'>
    <Row title='size'>
      <IconButton icon={Search} size='xs' />
      <IconButton icon={Search} size='sm' />
      <IconButton icon={Search} size='md' />
      <IconButton icon={Search} size='lg' />
      <IconButton icon={Search} size='xl' />
    </Row>

    <Row title='variant'>
      <IconButton icon={MoreHorizontal} variant='ghost' />
      <IconButton icon={Plus} variant='solid' />
      <IconButton icon={Trash2} variant='danger' />
      <IconButton icon={Edit2} variant='outline' />
      <IconButton icon={Plus} variant='circleSolid' shape='circle' />
    </Row>

    <Row title='shape=circle'>
      <IconButton icon={X} shape='circle' />
      <IconButton icon={Plus} shape='circle' variant='solid' />
      <IconButton icon={RefreshCw} shape='circle' variant='outline' />
    </Row>

    <Row title='tone (仅 ghost 时生效)'>
      <IconButton icon={Edit2} tone='blue' />
      <IconButton icon={Edit2} tone='green' />
      <IconButton icon={Edit2} tone='yellow' />
      <IconButton icon={Edit2} tone='purple' />
      <IconButton icon={Trash2} tone='red' />
    </Row>

    <Row title='selected'>
      <IconButton icon={Edit2} selected />
      <IconButton icon={Edit2} shape='circle' selected />
    </Row>

    <Row title='disabled'>
      <IconButton icon={X} disabled />
      <IconButton icon={Plus} variant='solid' disabled />
    </Row>

    <Row title='absolute + position（容器需 relative）'>
      <div className='relative w-[200px] h-[100px] border border-ui-border rounded-xl bg-[var(--page-bg)]'>
        <IconButton icon={X} size='sm' absolute position='tr' />
      </div>
    </Row>
  </div>
);
