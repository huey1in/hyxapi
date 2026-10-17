import { ToastContainer, showSuccess, showError, showInfo, showWarning } from './Toast';
import Button from '../button/Button';

export default { title: 'UI/Toast' };

export const AllTypes = () => (
  <div className='flex flex-wrap gap-2'>
    <Button onClick={() => showSuccess('保存成功')}>success</Button>
    <Button onClick={() => showInfo('提示信息')}>info</Button>
    <Button onClick={() => showWarning('注意：请确认...')}>warning</Button>
    <Button onClick={() => showError('删除失败')}>error</Button>
    <ToastContainer />
  </div>
);
