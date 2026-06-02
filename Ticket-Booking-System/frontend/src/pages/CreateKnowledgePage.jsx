import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  BookOpen, 
  Layout, 
  Tag, 
  HelpCircle,
  Cpu,
  Users,
  Briefcase,
  Globe
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { knowledgeService } from '../services/ticketService';
import { Card, Button, Input, Badge } from '../ui';
import { motion } from 'framer-motion';

const CATEGORIES = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Other'];

export default function CreateKnowledgePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'IT',
    content: '',
    tags: '',
    steps: [{ stepNumber: 1, instruction: '' }]
  });

  const handleAddStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { stepNumber: prev.steps.length + 1, instruction: '' }]
    }));
  };

  const handleRemoveStep = (index) => {
    const newSteps = formData.steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      stepNumber: i + 1
    }));
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const handleStepChange = (index, value) => {
    const newSteps = [...formData.steps];
    newSteps[index].instruction = value;
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return toast.error('Title and content are required');
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        steps: formData.steps.filter(s => s.instruction.trim() !== '')
      };
      
      await knowledgeService.create(payload);
      toast.success('Article created successfully!');
      navigate('/knowledge');
    } catch (err) {
      toast.error('Failed to create article');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex-between mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge')} leftIcon={<ArrowLeft size={18} />}>Back to Hub</Button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Create New Article</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: 'var(--s-6)' }}>
          <Card style={{ padding: 'var(--s-6)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--s-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <BookOpen size={18} color="var(--primary)" /> General Information
            </h3>
            <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
              <Input 
                label="Article Title" 
                placeholder="e.g. How to use the internal portal" 
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
              />
              
              <div>
                <label className="label">Category</label>
                <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: '4px' }}>
                  {CATEGORIES.map(cat => (
                    <Badge 
                      key={cat} 
                      variant={formData.category === cat ? 'primary' : 'outline'}
                      style={{ cursor: 'pointer', padding: '6px 12px' }}
                      onClick={() => setFormData({ ...formData, category: cat })}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 'var(--s-6)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--s-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Layout size={18} color="var(--primary)" /> Content & Tags
            </h3>
            <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
              <div>
                <label className="label">Article Content</label>
                <textarea 
                  className="input" 
                  style={{ minHeight: '200px', padding: '12px', resize: 'vertical' }}
                  placeholder="Provide a detailed overview of the topic..."
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  required
                />
              </div>
              <Input 
                label="Tags (comma separated)" 
                placeholder="e.g. tutorial, help, windows" 
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
          </Card>

          <Card style={{ padding: 'var(--s-6)' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <HelpCircle size={18} color="var(--primary)" /> Step-by-Step Guide
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddStep} leftIcon={<Plus size={16} />}>Add Step</Button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
              {formData.steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 'var(--s-4)', alignItems: 'flex-start' }}>
                  <div style={{ 
                    minWidth: '28px', 
                    height: '28px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '0.75rem', 
                    fontWeight: 800,
                    marginTop: '8px'
                  }}>
                    {step.stepNumber}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea 
                      className="input" 
                      style={{ minHeight: '80px', padding: '10px' }}
                      placeholder={`Instruction for step ${step.stepNumber}...`}
                      value={step.instruction}
                      onChange={e => handleStepChange(idx, e.target.value)}
                    />
                  </div>
                  {formData.steps.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveStep(idx)}
                      style={{ color: 'var(--danger)', marginTop: '8px' }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="flex-end gap-4 mt-4">
            <Button type="button" variant="outline" onClick={() => navigate('/knowledge')}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading} leftIcon={<Save size={18} />}>Publish Article</Button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
