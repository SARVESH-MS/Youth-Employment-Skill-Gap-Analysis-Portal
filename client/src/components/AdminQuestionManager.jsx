import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, BookOpenCheck, CheckCircle2, ClipboardCheck, Code2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import api, { dataOf, errorMessage } from '../api/client';
import { Badge, EmptyState, ErrorNotice, Field, FormSelect, Loading, Modal, PageMotion, SectionHeading } from './Common';
import { matchesSearch } from '../utils/search';

const managerConfig = {
  practice: { endpoint: '/admin/practice-questions', title: 'Practice questions', singular: 'practice question', icon: BookOpenCheck, description: 'Author scenario and knowledge checks for any skill. These questions appear in the shared practice workspace.' },
  coding: { endpoint: '/admin/coding-questions', title: 'Coding problems', singular: 'coding problem', icon: Code2, description: 'Manage problem statements, language templates, private test cases, and solutions for the isolated runner.' },
  tests: { endpoint: '/admin/question-bank', title: 'Assessment question bank', singular: 'bank question', icon: ClipboardCheck, description: 'Questions are drawn from this shared bank for student assessments and company recruitment rounds.' },
};

function emptyDefinition(kind) {
  if (kind === 'practice') return { type: 'scenario', difficulty: 'beginner', topic: '', title: '', prompt: '', scenario: '', hints: [], options: ['Option A', 'Option B'], correctIndex: 0, expectedAnswer: '', solutionExplanation: '', tags: [], order: 0, isActive: true };
  if (kind === 'coding') return { title: '', slug: '', statement: '', inputSpec: '', outputSpec: '', constraints: [], examples: [{ input: '', output: '', explanation: '' }], difficulty: 'beginner', topic: '', tags: [], supportedLanguages: ['javascript'], starterCode: { javascript: '' }, testCases: [{ input: '', expectedOutput: '', hidden: false }], solutions: { javascript: '' }, approach: '', timeComplexity: '', spaceComplexity: '', order: 0, isActive: true };
  return { difficulty: 'beginner', topic: '', prompt: '', options: ['Option A', 'Option B'], correctIndex: 0, explanation: '', tags: [], isActive: true };
}

export default function AdminQuestionManager({ kind }) {
  const config = managerConfig[kind] || managerConfig.tests;
  const Icon = config.icon;
  const [skills, setSkills] = useState([]);
  const [skillFilter, setSkillFilter] = useState('');
  const [draftSkill, setDraftSkill] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [definition, setDefinition] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const loadSkills = useCallback(async () => {
    try { setSkills(dataOf(await api.get('/admin/skills')) || []); }
    catch (reason) { setError(errorMessage(reason)); }
  }, []);
  const loadRows = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (skillFilter) params.set('skillId', skillFilter);
      const response = await api.get(`${config.endpoint}${params.size ? `?${params}` : ''}`);
      setRows(dataOf(response) || []);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }, [config.endpoint, skillFilter]);

  useEffect(() => { loadSkills(); }, [loadSkills]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const filtered = useMemo(() => rows.filter((row) => matchesSearch(query, row.title, row.prompt, row.statement, row.skill?.name, row.topic, row.tags)), [rows, query]);
  const startCreate = () => {
    setEditing(null);
    setDraftSkill(skills.find((skill) => skill.isActive)?._id || '');
    setDefinition(JSON.stringify(emptyDefinition(kind), null, 2));
    setError('');
  };
  const startEdit = (row) => {
    const clean = { ...row };
    ['_id', 'id', 'skill', 'createdAt', 'updatedAt', '__v', 'createdBy', 'updatedBy', 'owner'].forEach((field) => delete clean[field]);
    setEditing(row);
    setDraftSkill(row.skill?._id || row.skill || '');
    setDefinition(JSON.stringify(clean, null, 2));
    setError('');
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const parsed = JSON.parse(definition);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Enter one JSON object for this question.');
      if (!draftSkill) throw new Error('Select a skill from the shared catalog.');
      const payload = { ...parsed, skill: draftSkill };
      const response = editing
        ? await api.patch(`${config.endpoint}/${editing._id}`, payload)
        : await api.post(config.endpoint, payload);
      setNotice(response.data?.message || `${config.singular} saved.`);
      setEditing(null); setDefinition('');
      await loadRows();
    } catch (reason) { setError(reason instanceof SyntaxError ? 'The content definition must be valid JSON.' : errorMessage(reason)); }
    finally { setSaving(false); }
  };
  const setActive = async (row) => {
    setError(''); setNotice('');
    try {
      await api.patch(`${config.endpoint}/${row._id}`, { isActive: !row.isActive });
      setNotice(row.isActive ? 'Content archived.' : 'Content reactivated.');
      await loadRows();
    } catch (reason) { setError(errorMessage(reason)); }
  };

  return <PageMotion className="page-content">
    <SectionHeading eyebrow="CONTENT OPERATIONS" title={config.title} description={config.description} action={<button className="button button-primary" onClick={startCreate}><Plus size={15} />Add {config.singular}</button>} />
    <div className="question-manager-note"><Icon size={17} /><span>Content is stored against the central skill catalog. The assessment bank is shared by self-assessments and recruitment rounds.</span></div>
    <div className="question-manager-toolbar"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} /></label><select className="filter-select" value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} aria-label="Filter by skill"><option value="">All skills</option>{skills.map((skill) => <option value={skill._id} key={skill._id}>{skill.name}</option>)}</select></div>
    {notice && <div className="notice success-notice"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {error && <ErrorNotice message={error} onRetry={loadRows} />}
    {loading ? <Loading /> : filtered.length ? <div className="question-manager-list">{filtered.map((row) => <article className={`question-manager-row ${row.isActive ? '' : 'archived'}`} key={row._id}>
      <div className="question-manager-icon"><Icon size={17} /></div><div className="question-manager-copy"><div className="question-manager-meta"><strong>{row.title || row.prompt || row.statement}</strong><Badge tone={row.isActive ? 'green' : 'rose'}>{row.isActive ? 'Active' : 'Archived'}</Badge></div><p>{row.skill?.name || 'Skill'} · {row.difficulty || 'All levels'}{row.topic ? ` · ${row.topic}` : ''}{row.type ? ` · ${row.type}` : ''}</p><small>{row.options?.length ? `${row.options.length} options` : ''}{row.testCases?.length ? `${row.testCases.length} test cases` : ''}{row.supportedLanguages?.length ? ` · ${row.supportedLanguages.join(', ')}` : ''}</small></div>
      <div className="question-manager-actions"><button className="icon-button" aria-label={`Edit ${config.singular}`} title="Edit" onClick={() => startEdit(row)}><Pencil size={15} /></button><button className="icon-button" aria-label={row.isActive ? 'Archive content' : 'Reactivate content'} title={row.isActive ? 'Archive' : 'Reactivate'} onClick={() => setActive(row)}>{row.isActive ? <Archive size={15} /> : <RotateCcw size={15} />}</button></div>
    </article>)}</div> : <div className="panel"><EmptyState icon={Icon} title={`No ${config.title.toLowerCase()} yet`} description={`Add a ${config.singular} linked to a skill in the shared catalog.`} action={{ label: `Add ${config.singular}`, onClick: startCreate }} /></div>}
    {editing !== null || definition ? <Modal title={editing ? `Edit ${config.singular}` : `Add ${config.singular}`} onClose={() => { setEditing(null); setDefinition(''); }}><form className="modal-form" onSubmit={save}>
      <Field label="Catalog skill"><FormSelect required value={draftSkill} onChange={(event) => setDraftSkill(event.target.value)}><option value="">Choose a skill</option>{skills.filter((skill) => skill.isActive).map((skill) => <option value={skill._id} key={skill._id}>{skill.name}</option>)}</FormSelect></Field>
      <Field label="Question definition (JSON)" hint="Edit the structured fields for this content type. Arrays hold options, examples, tags, test cases, or language code. Correct answer indices start at 0."><textarea required className="input textarea code-textarea question-json-editor" rows="18" value={definition} onChange={(event) => setDefinition(event.target.value)} spellCheck="false" /></Field>
      {error && <div className="form-alert form-alert-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => { setEditing(null); setDefinition(''); }}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create content'}<Plus size={14} /></button></div>
    </form></Modal> : null}
  </PageMotion>;
}
