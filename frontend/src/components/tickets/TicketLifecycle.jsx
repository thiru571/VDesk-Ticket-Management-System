import React from 'react';

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '0m';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

const TicketLifecycle = ({ durations, systemAverages }) => {
  const stages = [
    { key: 'assigned', label: 'Assigned', icon: 'fa-user-check', color: '#8B5CF6' },
    { key: 'in_progress', label: 'In Progress', icon: 'fa-spinner', color: '#F59E0B' },
    { key: 'closed', label: 'Total Resolution', icon: 'fa-circle-check', color: '#10B981' }
  ];

  return (
    <div className="ticket-lifecycle-section" style={{
      marginTop: '16px',
      padding: '16px',
      background: 'rgba(31, 78, 121, 0.03)',
      borderRadius: '12px',
      border: '1px solid rgba(31, 78, 121, 0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '14px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        paddingBottom: '8px'
      }}>
        <i className="fa-solid fa-clock-rotate-left" style={{ color: '#1F4E79' }}></i>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F4E79', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Lifecycle Metrics
        </span>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '12px' 
      }}>
        {stages.map(stage => {
          const actual = durations?.[stage.key] || 0;
          const avg = systemAverages?.[stage.key] || 0;
          const isOver = actual > avg && avg > 0;

          return (
            <div key={stage.key} style={{
              padding: '10px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              border: '1px solid rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <i className={`fa-solid ${stage.icon}`} style={{ color: stage.color, fontSize: '0.75rem' }}></i>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                  {stage.label}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: isOver ? '#EF4444' : '#1F2937' }}>
                  {formatDuration(actual)}
                </span>
                {avg > 0 && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Avg: {formatDuration(avg)}
                  </span>
                )}
              </div>

              {avg > 0 && (
                <div style={{ 
                  height: '4px', 
                  background: '#F3F4F6', 
                  borderRadius: '2px', 
                  marginTop: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min((actual / avg) * 100, 100)}%`, 
                    background: isOver ? '#EF4444' : stage.color,
                    borderRadius: '2px'
                  }}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketLifecycle;
