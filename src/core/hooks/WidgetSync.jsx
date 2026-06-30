import { useEffect } from 'react';
import { useDashboardKPIs } from './useDexieHooks';
import { monthRange } from '../utils/format';

export default function WidgetSync() {
  const { start, end } = monthRange();
  useDashboardKPIs(start, end); // This hook handles syncing KPIs to native widget automatically
  return null;
}
