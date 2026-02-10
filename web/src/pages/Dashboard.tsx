import TaskInbox from '../components/TaskInbox';
import CalendarView from '../components/CalendarView';

export default function Dashboard() {
  return (
    <div className="split-view">
      {/* Left panel - Task Inbox */}
      <div className="split-view-left">
        <TaskInbox />
      </div>

      {/* Right panel - Calendar */}
      <div className="split-view-right">
        <CalendarView />
      </div>
    </div>
  );
}
