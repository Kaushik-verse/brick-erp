import { useEffect } from 'react';
import { useDashboardKPIs } from './useDexieHooks';

export default function WidgetSync() {
  useDashboardKPIs(); // This hook handles syncing KPIs to native widget automatically
  return null;
}
