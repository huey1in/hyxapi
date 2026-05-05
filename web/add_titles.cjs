#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pages = [
  { file: 'src/pages/Channel/index.jsx', title: '渠道管理' },
  { file: 'src/pages/Log/index.jsx', title: '使用日志' },
  { file: 'src/pages/User/index.jsx', title: '用户管理' },
  { file: 'src/pages/Redemption/index.jsx', title: '兑换码管理' },
  { file: 'src/pages/Subscription/index.jsx', title: '订阅管理' },
  { file: 'src/pages/TopUp/index.js', title: '钱包管理' },
  { file: 'src/pages/Playground/index.jsx', title: '操练场' },
  { file: 'src/pages/Dashboard/index.jsx', title: '数据看板' },
  { file: 'src/pages/Pricing/index.jsx', title: '定价套餐' },
  { file: 'src/pages/Setting/index.jsx', title: '系统设置' },
];

pages.forEach(({ file, title }) => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`✗ ${file} (not found)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 检查是否已经有 usePageTitle
  if (content.includes('usePageTitle')) {
    console.log(`  ${file} (already has usePageTitle)`);
    return;
  }

  // 1. 添加 import
  const importLine = "import { usePageTitle } from '../../hooks/common/usePageTitle';";

  // 在 react-i18next 导入后添加
  if (content.includes("from 'react-i18next'")) {
    content = content.replace(
      /(import.*from 'react-i18next';)/,
      `$1\n${importLine}`
    );
  } else if (content.includes("from 'react'")) {
    content = content.replace(
      /(import.*from 'react';)/,
      `$1\n${importLine}`
    );
  }

  // 2. 添加 usePageTitle 调用
  // 查找 const { t } = useTranslation(); 并在其后添加
  if (content.includes("const { t } = useTranslation();")) {
    content = content.replace(
      /(const { t } = useTranslation\(\);)/,
      `$1\n  usePageTitle(t('${title}'));`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ ${file} - ${title}`);
});

console.log('\nDone!');
