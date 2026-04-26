import CalendarView from '../components/CalendarView';
import { useCategoryFilterStore } from '../store/useCategoryFilterStore';

export default function Dashboard() {
  const activeCategoryFilter = useCategoryFilterStore((s) => s.activeCategoryFilter);

  return (
    <div className="split-view">
      <div className="split-view-main">
        <CalendarView activeCategory={activeCategoryFilter} />
      </div>
    </div>
  );
}
