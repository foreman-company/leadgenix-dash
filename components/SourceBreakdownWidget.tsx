import React from 'react';

interface SourceItem {
  source: string;
  count: number;
}

interface SourceBreakdownWidgetProps {
  /** Array of lead source data to render */
  data: SourceItem[];
}

const SourceBreakdownWidget: React.FC<SourceBreakdownWidgetProps> = ({ data }) => (
  <div className="source-breakdown-widget">
    <h3>Lead Sources</h3>
    <ul>
      {data.map((item, idx) => (
        <li key={idx}>
          {item.source}: {item.count}
        </li>
      ))}
    </ul>
  </div>
);

export default SourceBreakdownWidget;