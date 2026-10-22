import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import ModalShell from './ModalShell';
import ConfirmDialog from './ConfirmDialog';
import SlideOver from './SlideOver';
import Drawer from './Drawer';
import Button from '../button/Button';

export default { title: 'UI/Overlays' };

export const ModalDemo = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开 Modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title='创建新条目'
        confirmText='创建'
        onConfirm={() => { alert('created'); setOpen(false); }}
      >
        <p className='text-sm text-ui-text-2 leading-relaxed'>
          Modal = ModalShell + 标准 header/body/footer。下面演示 body 内容会自动 max-h-[70vh] 滚动。
        </p>
        <div className='space-y-2'>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className='text-sm text-ui-text-3'>第 {i + 1} 行内容</div>
          ))}
        </div>
      </Modal>
    </>
  );
};

export const ConfirmDialogDemo = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} icon={Trash2}>删除示例</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title='确定删除？'
        description='此操作不可恢复，将永久删除该条目及关联数据。'
        confirmText='删除'
        onConfirm={() => alert('deleted')}
      />
    </>
  );
};

export const SlideOverDemo = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开 SlideOver</Button>
      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        placement='right'
        title={<span className='text-base font-semibold text-ui-text'>编辑套餐</span>}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => setOpen(false)}>保存</Button>
          </>
        }
      >
        <div className='p-6 space-y-4'>
          <p className='text-sm text-ui-text-2'>SlideOver 适合编辑型大表单 — 比 Modal 更大且滚动友好。</p>
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className='text-sm text-ui-text-3 py-1'>表单字段 {i + 1}</div>
          ))}
        </div>
      </SlideOver>
    </>
  );
};

export const DrawerDemo = () => {
  const [open, setOpen] = useState(false);
  const [bottom, setBottom] = useState(false);
  return (
    <>
      <div className='flex gap-2'>
        <Button onClick={() => setOpen(true)}>右侧 Drawer</Button>
        <Button onClick={() => setBottom(true)}>底部 Drawer</Button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title='侧栏通知'>
        <div className='p-5 text-sm text-ui-text-2'>Drawer 与 SlideOver 类似，但支持四个方向。</div>
      </Drawer>
      <Drawer open={bottom} onClose={() => setBottom(false)} placement='bottom' size={240} title='底部抽屉'>
        <div className='p-5 text-sm text-ui-text-2'>从底部滑入，常用于移动端动作面板。</div>
      </Drawer>
    </>
  );
};

export const ModalShellRaw = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开 ModalShell (自定义内容)</Button>
      <ModalShell open={open} onClose={() => setOpen(false)} maxWidth={420}>
        <div className='p-8 text-center'>
          <AlertTriangle size={32} className='mx-auto text-amber-500 mb-3' />
          <div className='text-base font-semibold text-ui-text mb-1'>完全自定义内容</div>
          <div className='text-xs text-ui-text-3'>当 Modal 标准结构不满足时用 ModalShell。</div>
        </div>
      </ModalShell>
    </>
  );
};
