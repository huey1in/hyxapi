import { useState } from 'react';
import Textarea from './Textarea';
import NumberInput from './NumberInput';
import Switch from '../toggle/Switch';
import Checkbox from '../toggle/Checkbox';
import { RadioGroup } from '../toggle/Radio';
import Select from '../select/Select';
import Combobox from '../select/Combobox';
import MultiSelect from '../select/MultiSelect';
import TagInput from './TagInput';
import FieldRow from './FieldRow';

export default { title: 'UI/Form/All' };

const Row = ({ title, children }) => (
  <div className='mb-5'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    {children}
  </div>
);

export const AllControls = () => {
  const [text, setText] = useState('');
  const [num, setNum] = useState(10);
  const [on, setOn] = useState(true);
  const [chk, setChk] = useState(false);
  const [kids, setKids] = useState([true, false, false]);
  const allChecked = kids.every(Boolean);
  const noneChecked = kids.every((v) => !v);
  const toggleAll = (next) => setKids(kids.map(() => next));
  const toggleKid = (i, next) => setKids(kids.map((v, idx) => (idx === i ? next : v)));
  const [radio, setRadio] = useState('a');
  const [sel, setSel] = useState('a');
  const [cb, setCb] = useState('b');
  const [ms, setMs] = useState(['a', 'c']);
  const [tags, setTags] = useState(['gpt-4o', 'claude-3-5-sonnet']);

  const opts = [
    { value: 'a', label: '选项 A' },
    { value: 'b', label: '选项 B' },
    { value: 'c', label: '选项 C' },
    { value: 'd', label: '选项 D' },
  ];

  return (
    <div className='max-w-[640px] space-y-3'>
      <Row title='Textarea'>
        <Textarea value={text} onChange={setText} placeholder='多行输入...' rows={3} autoResize />
      </Row>
      <Row title='NumberInput'>
        <NumberInput value={num} onChange={setNum} min={0} max={100} step={1} />
      </Row>
      <Row title='Switch'>
        <div className='flex items-center gap-3'>
          <Switch checked={on} onChange={setOn} size='sm' />
          <Switch checked={on} onChange={setOn} size='md' />
          <span className='text-sm text-ui-text-2'>{on ? 'on' : 'off'}</span>
        </div>
      </Row>
      <Row title='Checkbox'>
        <div className='flex items-center gap-4'>
          <Checkbox checked={chk} onChange={setChk} label='接受条款' />
          <Checkbox disabled label='禁用' />
        </div>
        <div className='mt-3 ml-1'>
          <Checkbox
            checked={allChecked}
            indeterminate={!allChecked && !noneChecked}
            onChange={toggleAll}
            label='全选（半选 = 部分选中）'
          />
          <div className='mt-2 ml-6 flex flex-col gap-1'>
            {kids.map((v, i) => (
              <Checkbox key={i} checked={v} onChange={(n) => toggleKid(i, n)} label={`子项 ${i + 1}`} />
            ))}
          </div>
        </div>
      </Row>
      <Row title='RadioGroup'>
        <RadioGroup
          value={radio}
          onChange={setRadio}
          options={[
            { value: 'a', label: '选项 A' },
            { value: 'b', label: '选项 B' },
            { value: 'c', label: '禁用', disabled: true },
          ]}
        />
      </Row>
      <Row title='Select'>
        <Select options={opts} value={sel} onChange={setSel} />
      </Row>
      <Row title='Combobox (带搜索)'>
        <Combobox options={opts} value={cb} onChange={setCb} />
      </Row>
      <Row title='MultiSelect'>
        <MultiSelect options={opts} value={ms} onChange={setMs} placeholder='选多个' />
      </Row>
      <Row title='TagInput (自由输入，Enter / 逗号 提交)'>
        <TagInput value={tags} onChange={setTags} placeholder='输入模型名...' />
      </Row>
      <Row title='FieldRow + Input 组合（完整表单视图）'>
        <FieldRow label='名称' required hint='1-20 字符'>
          <input className='border border-ui-border rounded-xl bg-transparent text-ui-text outline-none focus:border-ui-text-3 transition-colors w-full px-3 py-2 text-sm' />
        </FieldRow>
      </Row>
    </div>
  );
};
