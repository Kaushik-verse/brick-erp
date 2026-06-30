import { useDashboardKPIs } from './useDexieHooks';
import { monthRange } from '../utils/format';

/**
 * WidgetSync — invisible component that lives in the App tree.
 * It calls useDashboardKPIs with the current month range, which
 * triggers native widget updates via the useEffect inside that hook.
 */
export default function WidgetSync() {
  const { start, end } = monthRange();
  useDashboardKPIs(start, end);
  return null;
}
