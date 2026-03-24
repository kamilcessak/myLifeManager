import { useState } from 'react';
import TaskInbox from '../components/TaskInbox';
import CalendarView from '../components/CalendarView';

export default function Dashboard() {
  const [activeCategory, setActiveCategory] = useState<string | 'all' | 'none'>('all');

  return (
    <div className="split-view">
      {/* Left panel - Task Inbox */}
      <div className="split-view-left">
        <TaskInbox activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
      </div>

      {/* Right panel - Calendar */}
      <div className="split-view-right">
        <CalendarView activeCategory={activeCategory} />
      </div>
    </div>
  );
}
