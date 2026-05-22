import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  Paperclip, 
  Info, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { ticketService, knowledgeService } from '../services/ticketService';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '../hooks/useDebounce';

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal'];
const SHIFTS = [
  { value: 'Morning', label: 'Morning Shift' },
  { value: 'Mid',     label: 'Mid Shift' },
  { value: 'Night',   label: 'Night Shift' },
];
const CATEGORY_SUB_MAPPING = {
  'IT': ['Network Issue', 'Software Issue', 'Hardware Issue', 'Access Request', 'Replacement', 'Laptop/Desktop Issue', 'Printer Issue', 'Email Login Issue'],
  'HR': ['Payroll', 'Leave Request', 'Benefits', 'Policy Query', 'Recruitment', 'Onboarding', 'Offboarding'],
  'Finance': ['Invoicing', 'Reimbursement', 'Taxation', 'Audit Support', 'Budgeting'],
  'Admin': ['Facilities', 'Security', 'Office Supplies', 'Event Support', 'ID Card Request'],
  'Operations': ['Logistics', 'Procurement', 'Inventory Management', 'Quality Control'],
  'Marketing': ['Campaign Support', 'Social Media', 'Branding Materials', 'Event Promotion'],
  'Sales': ['Lead Management', 'CRM Support', 'Sales Collateral', 'Client Feedback'],
  'Legal': ['Contract Review', 'Compliance', 'IP Management', 'Legal Documentation'],
  'Other': ['General Query', 'Miscellaneous']
};
const TICKET_TYPES = ['Network', 'Software', 'Hardware', 'Request', 'Replacement'];
const SOURCES = ['Portal', 'Mail', 'Digital', 'Onboard Lobby'];
const PRIORITIES = [
  { value: 'low',      label: ' Low',      color: '#10B981', desc: 'Not urgent — can wait a few days.' },
  { value: 'medium',   label: ' Medium',   color: '#4F46E5', desc: 'Needs attention but not blocking work.' },
  { value: 'high',     label: ' High',     color: '#F59E0B', desc: 'Blocking my work — needs fixing today.' },
  { value: 'critical', label: ' Critical', color: '#EF4444', desc: 'Everything is stopped — fix this right now!' },
];
const LOCATIONS = [
  { value: 'GICC',      icon: 'fa-building',   label: 'GICC Office' },
  { value: 'Bangalore', icon: 'fa-building',   label: 'Bangalore Office' },
  { value: 'Remote',    icon: 'fa-home',       label: 'Remote' },
  { value: 'Other',     icon: 'fa-ellipsis-h', label: 'Other' },
];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const locationRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    department: '',
    priority: 'medium',
    category: 'IT',
    subCategory: '',
    teamName: '',
    shift: '',
    ticketType: '',
    source: 'Portal',
    assetId: '',
    location: '',
    locationOther: ''
  });
  const [locationOpen, setLocationOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [similarTickets, setSimilarTickets] = useState([]);
  const [suggestedArticles, setSuggestedArticles] = useState([]);
  const [isSearchingSimilar, setIsSearchingSimilar] = useState(false);
  const [isSearchingArticles, setIsSearchingArticles] = useState(false);
  const debouncedTitle = useDebounce(form.title, 600);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (locationRef.current && !locationRef.current.contains(e.target)) {
        setLocationOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (debouncedTitle.trim().length > 4) {
      setIsSearchingSimilar(true);
      setIsSearchingArticles(true);
      
      ticketService.findSimilar({ title: debouncedTitle, category: form.category })
        .then(res => { setSimilarTickets(res.data.tickets || []); setIsSearchingSimilar(false); })
        .catch(() => setIsSearchingSimilar(false));
        
      knowledgeService.search({ q: debouncedTitle, category: form.category })
        .then(res => { setSuggestedArticles(res.data.articles || []); setIsSearchingArticles(false); })
        .catch(() => setIsSearchingArticles(false));
    } else {
      setSimilarTickets([]);
      setSuggestedArticles([]);
    }
  }, [debouncedTitle, form.category]);

  const selectedLocation = LOCATIONS.find(l => l.value === form.location);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.department) {
      return toast.error('Please fill in all required fields');
    }
    if (!form.location) {
      return toast.error('Please select a location');
    }
    if (form.location === 'Other' && !form.locationOther.trim()) {
      return toast.error('Please enter your specific location');
    }
    if (form.department === 'IT' && !form.assetId) {
      return toast.error('Asset ID is mandatory for IT tickets');
    }

    setLoading(true);
    const formData = new FormData();
    const finalLocation = form.location === 'Other' ? form.locationOther.trim() : form.location;
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'locationOther') return;
      if (k !== 'assetId') {
        formData.append(k, k === 'location' ? finalLocation : v);
      }
    });
    formData.append('context[assetId]', form.assetId);
    files.forEach(file => formData.append('attachments', file));

    try {
      await ticketService.create(formData);
      toast.success('Ticket submitted successfully');
      navigate('/tickets');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="page-layout"
      style={{ maxWidth: '960px', margin: '0 auto' }}
    >
      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-6)' }}>
        <div className="flex-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft size={20} /></Button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Report a Problem</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginTop: '2px' }}>Tell us what's wrong and we'll get the right team to help you.</p>
          </div>
        </div>
      </div>

      <div className="create-ticket-grid">
        <form onSubmit={handleSubmit} className="flex-col gap-6">
          <Card>
            <div className="flex-col" style={{ gap: 'var(--s-5)', padding: 'var(--s-2)' }}>

              {/* Title */}
              <div className="flex-col gap-1">
                <Input 
                  label="What's the problem? (Short title)" 
                  placeholder="e.g. My laptop won't turn on, Can't access email..."
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  required
                />
                <AnimatePresence>
                  {(similarTickets.length > 0 || suggestedArticles.length > 0) && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ marginTop: '8px', padding: '16px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}
                    >
                      {/* Suggested Articles */}
                      {suggestedArticles.length > 0 && (
                        <div style={{ marginBottom: similarTickets.length > 0 ? '16px' : 0 }}>
                          <div className="flex-center gap-2" style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem' }}>
                            <Info size={16} /> 
                            Instant Answers Found:
                          </div>
                          <div className="flex-col gap-2">
                            {suggestedArticles.map(a => (
                              <div 
                                key={a._id} 
                                onClick={() => window.open(`/knowledge/${a._id}`, '_blank')}
                                style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--primary-light)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <BookOpen size={14} color="var(--primary)" />
                                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{a.title}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {a.steps?.length > 0 && <Badge variant="primary" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>With Guide</Badge>}
                                  <ChevronRight size={14} color="var(--text-dim)" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Similar Tickets */}
                      {similarTickets.length > 0 && (
                        <div>
                          <div className="flex-center gap-2" style={{ color: '#D97706', fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem' }}>
                            <AlertTriangle size={16} /> 
                            Recent Related Tickets:
                          </div>
                          <div className="flex-col gap-2">
                            {similarTickets.map(t => (
                              <div 
                                key={t._id} 
                                onClick={() => window.open(`/tickets/${t._id}`, '_blank')}
                                style={{ padding: '10px 14px', background: 'white', border: '1px solid #FDE68A', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                                onMouseOver={e => { e.currentTarget.style.borderColor = '#D97706'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = '#FDE68A'; e.currentTarget.style.transform = 'translateX(0)'; }}
                              >
                                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{t.title}</span>
                                <span style={{ color: 'var(--text-dim)', textTransform: 'capitalize', fontSize: '0.7rem', fontWeight: 700 }}>{t.status.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Description */}
              <div className="input-group">
                <label className="input-label">Describe the problem in detail <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea 
                  className="input" 
                  style={{ height: '140px' }}
                  placeholder="What happened? When did it start? What were you doing at the time?"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  required
                />
              </div>

              {/* Department + Sub-Category */}
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Problem Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select 
                    className="input"
                    value={form.department}
                    onChange={e => { 
                      const dept = e.target.value; 
                      setForm({...form, department: dept, category: dept, subCategory: ''}); 
                    }}
                    required
                  >
                    <option value="">Select a team</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Sub-Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select 
                    className="input"
                    value={form.subCategory}
                    onChange={e => setForm({...form, subCategory: e.target.value})}
                    required
                    disabled={!form.category}
                  >
                    <option value="">Select sub-category</option>
                    {(CATEGORY_SUB_MAPPING[form.category] || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ticket Type + Source */}
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Ticket Type</label>
                  <select 
                    className="input"
                    value={form.ticketType}
                    onChange={e => setForm({...form, ticketType: e.target.value})}
                  >
                    <option value="">Select type</option>
                    {TICKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Submission Source</label>
                  <select 
                    className="input"
                    value={form.source}
                    onChange={e => setForm({...form, source: e.target.value})}
                  >
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Asset ID — IT only */}
              {form.department === 'IT' && (
                <div className="input-group">
                  <label className="input-label">Asset ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    className="input"
                    placeholder="e.g. LAP-12345, DT-67890"
                    value={form.assetId}
                    onChange={e => setForm({...form, assetId: e.target.value})}
                    required
                  />
                </div>
              )}

              {/* Shift + Team */}
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Shift</label>
                  <select
                    className="input"
                    value={form.shift}
                    onChange={e => setForm({...form, shift: e.target.value})}
                  >
                    <option value="">Select shift</option>
                    {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Your Team Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Sales North, Dev Team B"
                    value={form.teamName}
                    onChange={e => setForm({...form, teamName: e.target.value})}
                  />
                </div>
              </div>

              {/* Location dropdown */}
              <div className="input-group">
                <label className="input-label">
                  Location <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div ref={locationRef} style={{ position: 'relative' }}>
                  <div
                    onClick={() => setLocationOpen(o => !o)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      height: '44px', padding: '0 var(--s-4)',
                      background: 'var(--bg)',
                      border: `1.5px solid ${form.location ? '#1F4E79' : 'var(--border)'}`,
                      borderRadius: 'var(--r-md)', cursor: 'pointer',
                      fontSize: '0.9375rem', userSelect: 'none',
                      color: form.location ? 'var(--text-main)' : 'var(--text-dim)',
                      transition: 'border-color var(--t-fast)'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedLocation
                        ? <><i className={`fa-solid ${selectedLocation.icon}`} style={{ color: '#1F4E79', width: '16px', textAlign: 'center' }} />{selectedLocation.label}</>
                        : 'Select a location'
                      }
                    </span>
                    <i className={`fa-solid fa-chevron-${locationOpen ? 'up' : 'down'}`} style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }} />
                  </div>

                  {locationOpen && (
                    <div style={{
                      position: 'absolute', top: '48px', left: 0, right: 0, zIndex: 200,
                      background: 'white', border: '1.5px solid #1F4E79',
                      borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
                    }}>
                      {LOCATIONS.map((opt, idx) => (
                        <div
                          key={opt.value}
                          onClick={() => { setForm(f => ({ ...f, location: opt.value, locationOther: '' })); setLocationOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '11px var(--s-4)', cursor: 'pointer',
                            fontSize: '0.9375rem',
                            background: form.location === opt.value ? '#EFF6FF' : 'white',
                            color: form.location === opt.value ? '#1F4E79' : 'var(--text-main)',
                            fontWeight: form.location === opt.value ? 600 : 400,
                            borderBottom: idx < LOCATIONS.length - 1 ? '1px solid var(--border-light)' : 'none',
                            transition: 'background 0.1s'
                          }}
                          onMouseEnter={e => { if (form.location !== opt.value) e.currentTarget.style.background = 'var(--bg)'; }}
                          onMouseLeave={e => { if (form.location !== opt.value) e.currentTarget.style.background = 'white'; }}
                        >
                          <i className={`fa-solid ${opt.icon}`} style={{ width: '16px', textAlign: 'center', color: '#1F4E79' }} />
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {form.location === 'Other' && (
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Desk 402, Conference Room B"
                    value={form.locationOther}
                    onChange={e => setForm({ ...form, locationOther: e.target.value })}
                    required
                    style={{
                      marginTop: '10px', border: '1.5px solid #1F4E79',
                      borderRadius: 'var(--r-md)', padding: '0 var(--s-4)',
                      height: '44px', fontSize: '0.9375rem', fontFamily: 'inherit',
                      color: 'var(--text-main)', background: 'var(--bg)',
                      width: '100%', outline: 'none', transition: 'all var(--t-fast)'
                    }}
                    onFocus={e => { e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 4px var(--primary-light)'; }}
                    onBlur={e => { e.target.style.background = 'var(--bg)'; e.target.style.boxShadow = 'none'; }}
                  />
                )}
              </div>

              {/* File upload */}
              <div className="input-group">
                <label className="input-label">Attach a screenshot or file <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
                <div 
                  style={{ border: '2px dashed var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--s-6)', cursor: 'pointer', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'border-color var(--t-fast)' }}
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  <Paperclip size={22} color="var(--text-dim)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Click to upload a file</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Screenshots, photos, PDFs (Max 5MB)</span>
                  <input id="file-upload" type="file" multiple style={{ display: 'none' }} onChange={e => setFiles([...files, ...Array.from(e.target.files)])} />
                </div>
                {files.length > 0 && (
                  <div className="flex-col gap-2" style={{ marginTop: 'var(--s-4)' }}>
                    {files.map((file, idx) => (
                      <div key={idx} className="flex-between" style={{ padding: 'var(--s-2) var(--s-3)', background: 'var(--surface-alt)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}>
                        <span className="flex-center gap-2"><CheckCircle2 size={14} color="var(--success)" /> {file.name}</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-3)', marginTop: 'var(--s-2)' }}>
            <Button variant="ghost" onClick={() => navigate(-1)}>Go Back</Button>
            <Button size="lg" type="submit" isLoading={loading} rightIcon={<Send size={18} />}>Send My Request</Button>
          </div>
        </form>

        {/* Right Panel */}
        <div className="flex-col gap-5">
          <Card title="How urgent is this?">
            <div className="flex-col" style={{ gap: 'var(--s-3)' }}>
              {PRIORITIES.map(p => (
                <label 
                  key={p.value}
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px', border: `2px solid ${form.priority === p.value ? p.color : 'var(--border)'}`, borderRadius: 'var(--r-md)', cursor: 'pointer', background: form.priority === p.value ? `${p.color}10` : 'var(--bg)', transition: 'all var(--t-fast)' }}
                >
                  <input 
                    type="radio" name="priority" value={p.value} 
                    checked={form.priority === p.value}
                    onChange={e => setForm({...form, priority: e.target.value})}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: form.priority === p.value ? p.color : 'var(--text-main)' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color, flexShrink: 0, display: 'inline-block' }} />
                    {p.label}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4, paddingLeft: '18px' }}>{p.desc}</p>
                </label>
              ))}
            </div>
          </Card>

          <Card title="💡 Quick Tip" style={{ background: '#EEF2FF' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, lineHeight: 1.5 }}>Adding a screenshot helps our team fix your problem much faster!</p>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}