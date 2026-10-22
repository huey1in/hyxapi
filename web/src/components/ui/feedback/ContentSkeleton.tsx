import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../tokens';
import Skeleton from './Skeleton';

type SkeletonVariant = 'table' | 'cards' | 'tokens' | 'form' | 'dashboard' | 'text';
interface ContentSkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  children: ReactNode;
}

export default function ContentSkeleton({ variant = 'table', className, children }: ContentSkeletonProps) {
  const { t } = useTranslation();
  return <div role='status' aria-label={t('Loading...')} aria-busy='true' data-loading-skeleton={variant} className={cn('w-full min-w-0', className)}>
    <div aria-hidden='true'>{children}</div>
  </div>;
}

// Preserve the real form geometry while masking remote values and actions.
export function LayoutSkeleton({ loading, children, className }: { loading: boolean; children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return <div role={loading ? 'status' : undefined} aria-label={loading ? t('Loading...') : undefined} aria-busy={loading || undefined} data-loading-skeleton={loading ? 'form' : undefined} className={cn('min-w-0', loading && 'layout-skeleton', className)}>
    <div inert={loading || undefined} aria-hidden={loading || undefined} data-skeleton={loading ? '' : undefined}>{children}</div>
  </div>;
}

export function ParagraphSkeleton({ lines = 3 }: { lines?: number }) {
  return <ContentSkeleton variant='text'><div className='space-y-3'><Skeleton height={18} count={lines} /><Skeleton height={18} width='65%' /></div></ContentSkeleton>;
}
