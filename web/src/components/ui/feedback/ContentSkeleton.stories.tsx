import { LayoutSkeleton, ParagraphSkeleton } from './ContentSkeleton';
import TableComponent from '../layout/Table';
import Input from '../input/Input';
import { DashboardStatsSkeleton, MySubscriptionSkeleton, PersonalSkeleton, PricingCardsSkeleton, TokenCardsSkeleton, StatisticsSkeleton } from '../../layout/PageSkeletons';

export default { title: 'UI/Content Skeleton' };

export const Table = () => <TableComponent loading columns={[{ key: 'name', title: 'Name', width: '40%' }, { key: 'status', title: 'Status' }, { key: 'actions', title: 'Actions', align: 'right' }]} rows={[]} />;
export const Pricing = () => <PricingCardsSkeleton />;
export const Tokens = () => <TokenCardsSkeleton />;
export const Form = () => <LayoutSkeleton loading><label className='grid gap-2 text-sm'>Server address<Input value='' width='full' disabled /></label></LayoutSkeleton>;
export const Dashboard = () => <DashboardStatsSkeleton />;
export const Document = () => <ParagraphSkeleton />;
export const Personal = () => <PersonalSkeleton />;
export const Subscriptions = () => <MySubscriptionSkeleton />;
export const Operations = () => <StatisticsSkeleton />;
export const SystemStatus = () => <StatisticsSkeleton system />;
