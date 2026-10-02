import React from 'react';

interface LeadVolumeWidgetProps {
  /** Number of leads to display */
  leadVolume: number;
}

const LeadVolumeWidget: React.FC<LeadVolumeWidgetProps> = ({ leadVolume }) => (
  <div
    style={{
      padding: 'var(--spacing-4)',
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      textAlign: 'center',
      color: 'var(--foreground)',
    }}
  >
    <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Lead Volume</h2>
    <p style={{ fontSize: 'var(--font-size-2xl)', margin: 0 }}>{leadVolume}</p>
  </div>
);

export default LeadVolumeWidget;