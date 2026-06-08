import React, { useState, useEffect } from 'react';
import KpiCard from './KpiCard';

const Dashboard = () => {
  const [eventsToday, setEventsToday] = useState(0);
  const [highRiskZones, setHighRiskZones] = useState(0);

  useEffect(() => {
    setEventsToday(25);
    setHighRiskZones(8);
  }, []);

  return (
    <div className="dashboard">
      <KpiCard title="Events Today" value={eventsToday} />
      <KpiCard title="High-Risk Zones" value={highRiskZones} />
    </div>
  );
};

export default Dashboard;