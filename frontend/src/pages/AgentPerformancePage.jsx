import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ticketService } from '../services/ticketService';
import { useToast } from '../context/ToastContext';
import { 
  Clock, 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  ArrowUpRight, 
  Search, 
  Filter,
  BarChart3
} from 'lucide-react';
import { Button, Card, Badge } from '../ui';

const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export default function AgentPerformancePage() {
  const toast = useToast();
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    try {
      const res = await ticketService.getAgentPerformance();
      setPerformanceData(res.data.data);
    } catch (err) {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = performanceData.filter(agent => 
    agent.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.agentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="page-layout animate-pulse" style={{ padding: '40px' }}>
      <div style={{ height: '40px', width: '300px', background: 'var(--border-light)', borderRadius: '8px', marginBottom: '24px' }} />
      <div className="dashboard-grid-3" style={{ marginBottom: '32px' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: '120px', background: 'var(--border-light)', borderRadius: '24px' }} />)}
      </div>
      <div style={{ height: '400px', background: 'var(--border-light)', borderRadius: '24px' }} />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="page-layout"
      style={{ padding: '40px' }}
    >
      <div className="flex-between mb-8">
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-main)', margin: 0 }}>
            Agent Efficiency
          </h1>
          <p style={{ color: 'var(--text-dim)', fontWeight: 600, marginTop: '4px' }}>
            Real-time tracking of resolution speed and workload metrics.
          </p>
        </div>
        <div className="flex-center gap-3">
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              className="input" 
              placeholder="Search agent name or email..."
              style={{ width: '300px', paddingLeft: '48px', height: '48px', borderRadius: '16px', background: 'white' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="lg" leftIcon={<Filter size={18} />}>Filters</Button>
        </div>
      </div>

      <div className="dashboard-grid-3 mb-8">
        <Card style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)', color: 'white', border: 'none' }}>
          <div className="flex-between mb-4">
            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <Badge variant="ghost" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>Active Agents</Badge>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{performanceData.length}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 600 }}>Total verified agents tracked</div>
        </Card>

        <Card style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', border: 'none' }}>
          <div className="flex-between mb-4">
            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} />
            </div>
            <Badge variant="ghost" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>Resolution Total</Badge>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>
            {performanceData.reduce((acc, curr) => acc + curr.totalResolved, 0)}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 600 }}>Across all priority tiers</div>
        </Card>

        <Card style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white', border: 'none' }}>
          <div className="flex-between mb-4">
            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <Badge variant="ghost" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>System Average</Badge>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>
            {performanceData.length > 0 
              ? formatDuration(performanceData.reduce((acc, curr) => acc + curr.avgResolutionTimeMs, 0) / performanceData.length)
              : '0s'}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 600 }}>Mean time to resolution (MTTR)</div>
        </Card>
      </div>

      <Card title="Agent Performance Ranking" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Resolution Time</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speed Index</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((agent, index) => {
                const speedColor = index === 0 ? '#10B981' : index === filteredData.length - 1 ? '#EF4444' : 'var(--primary)';
                return (
                  <tr key={agent._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '20px 24px' }}>
                      <div className="flex-center gap-3">
                        <div style={{ width: '40px', height: '40px', background: 'var(--primary-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800 }}>
                          {agent.agentName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{agent.agentName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>{agent.agentEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                      <Badge variant="info" style={{ fontWeight: 800, padding: '4px 12px', borderRadius: '8px' }}>
                        {agent.totalResolved} Tickets
                      </Badge>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                      <div className="flex-center gap-2" style={{ fontWeight: 900, color: 'var(--text-main)' }}>
                        <Clock size={16} color="var(--text-dim)" />
                        {formatDuration(agent.avgResolutionTimeMs)}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px', width: '250px' }}>
                      <div className="flex-col gap-2">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                          <span>Efficiency</span>
                          <span style={{ color: speedColor }}>{index === 0 ? 'Optimal' : index > filteredData.length / 2 ? 'Needs Focus' : 'Stable'}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(20, 100 - (index * (100 / filteredData.length)))}%` }}
                            style={{ height: '100%', background: speedColor, borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" rightIcon={<ArrowUpRight size={14} />}>Details</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 grid-2 gap-6">
        <Card title="Top Resolution Streaks">
           <div className="flex-col gap-4">
              {filteredData.slice(0, 3).map((agent, i) => (
                <div key={agent._id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                   <div style={{ fontSize: '1.5rem' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                   <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{agent.agentName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Fastest resolution time this period</div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#10B981' }}>{formatDuration(agent.avgResolutionTimeMs)}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)' }}>AVG MTTR</div>
                   </div>
                </div>
              ))}
           </div>
        </Card>
        
        <Card title="Recent Accomplishments">
           <div className="flex-col gap-4">
              <div className="flex gap-4">
                 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                    <TrendingUp size={20} />
                 </div>
                 <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>System Turnaround Improved</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>Overall resolution speed has increased by 12% compared to last week.</p>
                 </div>
              </div>
              <div className="flex gap-4">
                 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                    <BarChart3 size={20} />
                 </div>
                 <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Peak Performance Hour</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>Most tickets are being resolved between 10 AM and 12 PM.</p>
                 </div>
              </div>
           </div>
        </Card>
      </div>
    </motion.div>
  );
}
