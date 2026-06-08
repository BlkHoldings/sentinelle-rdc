import { render, screen } from '@testing-library/react';
import KpiCard from './KpiCard';

test('renders KPI Card', () => {
  render(<KpiCard title="Test KPI" value={42} />);
  expect(screen.getByText('Test KPI')).toBeInTheDocument();
  expect(screen.getByText('42')).toBeInTheDocument();
});