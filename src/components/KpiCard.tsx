import React from 'react';

interface KpiCardProps {
  title: string;
  value: number;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
  return (
    <div className="kpi-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
};

export default KpiCard;