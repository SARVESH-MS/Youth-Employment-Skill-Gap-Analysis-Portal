import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { sql } from '@codemirror/lang-sql';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { acceptCompletion, autocompletion, completionStatus } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { Decoration, keymap, ViewPlugin, WidgetType } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, BookOpenCheck, Bookmark, Check, CheckCircle2, Clock3, Code2, Copy, FileQuestion, Play, Send, Sparkles, SquareTerminal, Target, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { dataOf, errorMessage } from '../api/client';
import { useAuth } from '../app/AuthContext';
import { Badge, EmptyState, ErrorNotice, Field, FormSelect, Loading, Modal, PageMotion, ProgressBar, SectionHeading } from '../components/Common';

const sections = [
  { id: 'about', label: 'About' },
  { id: 'learning', label: 'Learning materials' },
  { id: 'practice', label: 'Practice' },
  { id: 'assessment', label: 'Test / assessment' },
];

export default function SkillPage({ skillId, onNavigate }) {
  const { user } = useAuth();
  const [skillData, setSkillData] = useState(null); const [learning, setLearning] = useState(null); const [practice, setPractice] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [active, setActive] = useState('about'); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    Promise.all([
      api.get(`/catalog/skills/${skillId}`),
      api.get(`/student/skills/${skillId}/learning`),
      api.get(`/student/practice/${skillId}`),
    ]).then(async ([catalogResponse, learningResponse, practiceResponse]) => {
      const nextSkill = dataOf(catalogResponse);
      if (alive) { setSkillData(nextSkill); setLearning(dataOf(learningResponse)); setPractice(dataOf(practiceResponse)); }
    }).catch((reason) => { if (alive) setError(errorMessage(reason)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [skillId, refresh]);
  const progressMap = useMemo(() => new Map((Array.isArray(learning?.progress) ? learning.progress : []).map((item) => [String(item.subtopicId), item])), [learning]);
  const totalSubtopics = (Array.isArray(learning?.modules) ? learning.modules : []).reduce((sum, module) => sum + (Array.isArray(module.topics) ? module.topics : []).reduce((topicSum, topic) => topicSum + (Array.isArray(topic.subtopics) ? topic.subtopics.length : 0), 0), 0);
  const completedSubtopics = (learning?.progress || []).filter((item) => item.status === 'completed').length;
  const progress = totalSubtopics ? Math.round(completedSubtopics / totalSubtopics * 100) : 0;
  const skill = skillData?.skill;
  const personalStatus = learning?.progress?.some((item) => item.status === 'completed') ? progress === 100 ? 'completed' : 'in-progress' : 'not-started';
  if (loading) return <div className="skill-page-loading"><Loading /></div>;
  if (error) return <PageMotion className="page-content"><ErrorNotice message={error} onRetry={() => setRefresh((value) => value + 1)} /></PageMotion>;
  if (!skill) return <PageMotion className="page-content"><EmptyState icon={BookOpen} title="Skill information is unavailable" description="Return to the skill library and choose a skill again." /></PageMotion>;
  return <PageMotion className="page-content skill-page">
    <div className="skill-breadcrumb"><Link to="/student/skills"><ArrowLeft size={14} />All skills</Link><span>/</span><span>{skill.name}</span></div>
    <section className="skill-hero"><div className="skill-hero-main"><div className="skill-hero-meta"><span className="skill-category-label">{skill.category}</span><Badge tone="blue">{skill.difficulty}</Badge>{skill.executionType !== 'none' && <Badge tone="violet">Interactive practice</Badge>}</div><h1>{skill.name}</h1><p>{skill.shortDescription || skill.description}</p><div className="skill-hero-domains">{(skillData.domains || []).map((domain) => <span key={domain._id}>{domain.name}</span>)}</div><div className="skill-hero-actions"><button className="button button-primary" onClick={() => setActive('learning')}>Continue learning<ArrowRight size={15} /></button><button className="button button-quiet" onClick={() => setActive('assessment')}>Take an assessment<FileQuestion size={15} /></button></div></div><div className="skill-hero-progress"><div className="skill-progress-ring" style={{ '--value': `${progress}%` }}><div><strong>{progress}<small>%</small></strong><span>COMPLETE</span></div></div><span>{completedSubtopics} of {totalSubtopics} lesson units</span><Badge tone={personalStatus === 'completed' ? 'green' : personalStatus === 'in-progress' ? 'amber' : 'neutral'}>{personalStatus === 'not-started' ? 'Not started' : personalStatus.replace('-', ' ')}</Badge></div></section>
    <div className="skill-tabs" role="tablist" aria-label={`${skill.name} learning sections`}>{sections.map((item) => <button key={item.id} role="tab" aria-selected={active === item.id} className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)}>{item.label}{item.id === 'assessment' && <span className="tab-count">10 sets</span>}</button>)}</div>
    {active === 'about' && <AboutSkill skill={skill} domains={skillData.domains || []} />}
    {active === 'learning' && <LearningMaterials skill={skill} modules={learning?.modules || []} progressMap={progressMap} refresh={() => setRefresh((value) => value + 1)} />}
    {active === 'practice' && <PracticeArea skill={skill} questions={practice || []} />}
    {active === 'assessment' && <AssessmentArea skill={skill} />}
  </PageMotion>;
}

function AboutSkill({ skill, domains }) {
  const about = skill.about || {};
  return <div className="skill-about-grid"><section className="panel about-main"><div className="eyebrow">THE FOUNDATION</div><h2>What is {skill.name}?</h2><p>{about.whatItIs || skill.description || `${skill.name} is a practical technology skill used by product teams.`}</p><h3>Why it matters</h3><p>{about.whyItMatters || `${skill.name} helps teams build reliable, understandable product experiences and solve real problems.`}</p><div className="about-application-grid"><div><span className="about-icon"><Target size={17} /></span><strong>Where it is used</strong><p>{about.whereItIsUsed || 'Across digital products and technology teams.'}</p></div><div><span className="about-icon"><Sparkles size={17} /></span><strong>Career relevance</strong><p>{about.careerRelevance || 'A useful foundation for early-career technology roles.'}</p></div></div><h3>Real-world applications</h3><ul className="clean-list">{(about.realWorldApplications?.length ? about.realWorldApplications : [`Build product experiences with ${skill.name}`, 'Improve an existing application', 'Collaborate on a software team']).map((item) => <li key={item}><CheckCircle2 size={15} />{item}</li>)}</ul></section><aside className="skill-facts"><article className="panel fact-card"><span className="eyebrow">CAREER PATHS</span><h3>Where this skill fits</h3><div className="domain-chip-list">{domains.map((domain) => <span key={domain._id}>{domain.name}<ArrowUpRight size={13} /></span>)}</div>{!domains.length && <p>Connects to roles across the technology sector.</p>}</article><article className="panel fact-card"><span className="eyebrow">RELATED KNOWLEDGE</span><h3>Good to know alongside</h3><div className="related-tech-list">{(about.relatedTechnologies || []).map((item) => <span key={item}>{item}</span>)}{!about.relatedTechnologies?.length && <span>Problem solving</span>}</div><p><strong>Prerequisites:</strong> {about.prerequisiteNotes || 'No prerequisites. Start with the first learning module.'}</p></article><article className="career-relevance-card"><Sparkles size={17} /><div><strong>Job relevance</strong><p>{about.jobRelevance || `${skill.name} appears in entry-level roles and can be demonstrated through projects and practice.`}</p></div></article></aside></div>;
}

function CurriculumReferences({ references = [] }) {
  if (!references.length) return null;
  return <details className="curriculum-references"><summary>Sources and optional further reading</summary><ul>{references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}<ArrowUpRight size={12} /></a>{reference.publisher && <small>{reference.publisher}</small>}</li>)}</ul><p>Lessons and practice stay inside YESGAP; these links document the source material used to prepare this module.</p></details>;
}

function LearningMaterials({ skill, modules, progressMap, refresh }) {
  const safeModules = Array.isArray(modules) ? modules.map((item) => ({ ...item, topics: Array.isArray(item.topics) ? item.topics.map((topic) => ({ ...topic, subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [] })) : [] })) : [];
  const [activeModule, setActiveModule] = useState(safeModules[0]?._id || ''); const [selected, setSelected] = useState(null); const [seconds, setSeconds] = useState(0); const [quizAnswers, setQuizAnswers] = useState({}); const [quizResult, setQuizResult] = useState(null); const [note, setNote] = useState(''); const [feedback, setFeedback] = useState(''); const [busy, setBusy] = useState(false);
  const selectedModuleId = safeModules.some((item) => String(item._id) === String(activeModule)) ? activeModule : (safeModules[0]?._id || '');
  const module = safeModules.find((item) => String(item._id) === String(selectedModuleId));
  useEffect(() => {
    if (String(activeModule) === String(selectedModuleId)) return;
    setActiveModule(selectedModuleId);
    setSelected(null);
  }, [activeModule, selectedModuleId]);
  const subtopic = selected && module?.topics.flatMap((topic) => topic.subtopics.map((item) => ({ ...(item.toObject ? item.toObject() : item), topicTitle: topic.title, topicId: topic._id }))).find((item) => String(item._id) === String(selected));
  useEffect(() => { setSeconds(0); setQuizAnswers({}); setQuizResult(null); if (!module || !subtopic) return undefined; const timer = setInterval(async () => { setSeconds((value) => value + 15); try { await api.post(`/student/learning/${module._id}/${subtopic._id}/engagement`, { seconds: 15 }); } catch { /* A later page refresh can retry progress. */ } }, 15000); return () => clearInterval(timer); }, [module?._id, subtopic?._id]);
  const addAnnotation = async (type) => { setFeedback(''); try { await api.post('/student/annotations', { type, skillId: skill._id, moduleId: module?._id, subtopicId: subtopic?._id, label: type === 'bookmark' ? subtopic?.title : note.slice(0, 100), content: type === 'note' ? note : '' }); setFeedback(type === 'bookmark' ? 'Lesson bookmarked.' : 'Personal note saved.'); } catch (error) { setFeedback(errorMessage(error)); } };
  const submitQuiz = async () => { if (!module || !subtopic) return; setBusy(true); setFeedback(''); try { const response = await api.post(`/student/learning/${module._id}/${subtopic._id}/checkpoint`, { answers: subtopic.checkpoints.map((_item, index) => Number(quizAnswers[index] ?? -1)) }); const result = dataOf(response); setQuizResult(result); if (result.passed) refresh(); } catch (error) { setFeedback(errorMessage(error)); } finally { setBusy(false); } };
  if (!safeModules.length) return <div className="panel"><EmptyState icon={BookOpen} title="No learning material published yet" description={`The ${skill.name} curriculum is ready to grow as modules are authored in the admin workspace.`} /></div>;
  return <div className="learning-layout"><aside className="learning-toc panel"><div className="toc-head"><div className="eyebrow">CONTENTS</div><strong>{skill.name}</strong></div>{safeModules.map((item, index) => <div className="toc-module" key={item._id}><button className={`toc-module-button ${String(selectedModuleId) === String(item._id) ? 'active' : ''}`} onClick={() => { setActiveModule(item._id); setSelected(null); }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong></button>{String(selectedModuleId) === String(item._id) && item.topics.map((topic) => <div className="toc-topic-group" key={topic._id}><span>{topic.title}</span>{topic.subtopics.map((itemSubtopic) => { const state = progressMap.get(String(itemSubtopic._id)); return <button key={itemSubtopic._id} className={`toc-subtopic ${String(selected) === String(itemSubtopic._id) ? 'active' : ''}`} onClick={() => { setSelected(itemSubtopic._id); setFeedback(''); }}>{state?.status === 'completed' ? <CheckCircle2 size={13} /> : <span className="toc-bullet" />}{itemSubtopic.title}</button>; })}</div>)}</div>)}<div className="toc-estimate"><Clock3 size={14} />About {safeModules.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0)} minutes total</div></aside><section className="lesson-content">{!subtopic ? <div className="panel lesson-start"><div className="lesson-start-icon"><BookOpenCheck size={25} /></div><div className="eyebrow">START A MODULE</div><h2>{module?.title || 'Choose a lesson'}</h2><p>{module?.description}</p>{module?.objectives?.length > 0 && <div className="objective-list"><strong>In this module you will:</strong>{module.objectives.map((objective) => <span key={objective}><Check size={14} />{objective}</span>)}</div>}<CurriculumReferences references={module?.references} /><button className="button button-primary" onClick={() => setSelected(module?.topics?.[0]?.subtopics?.[0]?._id)}>Open first lesson<ArrowRight size={15} /></button></div> : <article className="lesson-article"><div className="lesson-article-top"><div><div className="eyebrow">{subtopic.topicTitle}</div><h2>{subtopic.title}</h2></div><div className="lesson-toolbar"><span><Clock3 size={14} />{subtopic.estimatedMinutes || 12} min</span><button className="icon-button" aria-label="Bookmark lesson" onClick={() => addAnnotation('bookmark')}><Bookmark size={16} /></button></div></div><CurriculumReferences references={module?.references} />{subtopic.theory?.split('\n\n').map((paragraph, index) => <p className="lesson-paragraph" key={index}>{paragraph}</p>)}{subtopic.keyPoints?.length > 0 && <div className="key-points"><strong>Key points</strong>{subtopic.keyPoints.map((point) => <div key={point}><CheckCircle2 size={15} />{point}</div>)}</div>}{subtopic.examples?.map((example, index) => <div className="lesson-example" key={index}><div className="lesson-example-title"><strong>{example.title || 'Example'}</strong><button onClick={async () => { try { await navigator.clipboard.writeText(example.code); setFeedback('Code copied.'); } catch { setFeedback('Clipboard access is unavailable in this browser.'); } }}><Copy size={13} />Copy code</button></div><pre><code>{example.code}</code></pre>{example.output && <div className="example-output"><span>OUTPUT</span><code>{example.output}</code></div>}{example.explanation && <p>{example.explanation}</p>}</div>)}{subtopic.realWorldExample && <div className="real-world-box"><div className="eyebrow">IN PRACTICE</div><p>{subtopic.realWorldExample}</p></div>}{subtopic.exercise && <div className="exercise-box"><div className="eyebrow">YOUR TURN</div><p>{subtopic.exercise}</p>{subtopic.exerciseSolution && <details><summary>Show an example approach</summary><p>{subtopic.exerciseSolution}</p></details>}</div>}{subtopic.summary && <div className="lesson-summary"><strong>Summary</strong><p>{subtopic.summary}</p></div>}{subtopic.checkpoints?.length > 0 && <div className="checkpoint-card"><div className="checkpoint-head"><div><div className="eyebrow">CHECKPOINT</div><h3>Check your understanding</h3></div><Badge tone="blue">{subtopic.checkpoints.length} question{subtopic.checkpoints.length === 1 ? '' : 's'}</Badge></div>{subtopic.checkpoints.map((question, index) => <fieldset className="checkpoint-question" key={index}><legend>{question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={`checkpoint-${index}`} checked={Number(quizAnswers[index]) === optionIndex} onChange={() => setQuizAnswers((current) => ({ ...current, [index]: optionIndex }))} />{option}</label>)}</fieldset>)}{quizResult && <div className={`checkpoint-result ${quizResult.passed ? 'passed' : 'retry'}`}>{quizResult.passed ? 'Checkpoint passed. This lesson is marked complete.' : `Score: ${quizResult.score}%. Review the lesson and try again.`}</div>}<button disabled={busy || Object.keys(quizAnswers).length < subtopic.checkpoints.length} className="button button-primary button-small" onClick={submitQuiz}>{busy ? 'Checking…' : 'Submit checkpoint'}<ArrowRight size={14} /></button></div>}{subtopic.exerciseSolution && <div className="personal-note-box"><Field label="Personal notes"><textarea className="input textarea" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a thought or question for yourself…" /></Field><button className="button button-soft button-small" disabled={!note.trim()} onClick={() => addAnnotation('note')}>Save private note<Bookmark size={14} /></button></div>}{feedback && <div className="notice">{feedback}</div>}<div className="lesson-engagement"><span><Clock3 size={14} />{Math.min(seconds, 45)} / 45 sec engagement</span><ProgressBar value={progressMap.get(String(subtopic._id))?.status === 'completed' ? 100 : Math.min(seconds / 45 * 99, 99)} /><span>{progressMap.get(String(subtopic._id))?.status === 'completed' ? 'Lesson completed' : 'Completion requires engaged reading or the checkpoint quiz.'}</span></div><div className="lesson-navigation"><button className="button button-quiet" onClick={() => { const all = safeModules.flatMap((item) => item.topics.flatMap((topic) => topic.subtopics)); const index = all.findIndex((item) => String(item._id) === String(subtopic._id)); setSelected(all[index - 1]?._id || null); }}><ArrowLeft size={14} />Previous lesson</button><button className="button button-soft" onClick={() => { const all = safeModules.flatMap((item) => item.topics.flatMap((topic) => topic.subtopics)); const index = all.findIndex((item) => String(item._id) === String(subtopic._id)); setSelected(all[index + 1]?._id || null); }}>Next lesson<ArrowRight size={14} /></button></div></article>}</section></div>;
}

function PracticeArea({ skill, questions }) {
  const { user } = useAuth(); const canCompile = skill.executionType !== 'none'; const [mode, setMode] = useState(canCompile ? 'compiler' : 'practice');
  return <div className="practice-area"><div className="practice-mode-tabs"><button className={mode === 'practice' ? 'active' : ''} onClick={() => setMode('practice')}><Target size={15} />Scenario practice<Badge tone="neutral">{questions.length}</Badge></button>{canCompile && <button className={mode === 'compiler' ? 'active' : ''} onClick={() => setMode('compiler')}><Code2 size={15} />Compiler</button>}</div>{mode === 'compiler' && canCompile ? <CodePractice theme={user.theme} /> : <PracticeQuestions questions={questions} />}</div>;
}

function PracticeQuestions({ questions }) {
  const [answers, setAnswers] = useState({}); const [responses, setResponses] = useState({}); const [busy, setBusy] = useState('');
  if (!questions.length) return <div className="panel"><EmptyState icon={Target} title="Practice is being prepared" description="There are no scenario questions for this skill yet." /></div>;
  const submit = async (question) => { if (answers[question._id] === undefined) return; setBusy(question._id); try { const response = await api.post(`/student/practice/${question._id}/submit`, { selectedIndex: Number(answers[question._id]) }); setResponses((current) => ({ ...current, [question._id]: dataOf(response) })); } catch (error) { setResponses((current) => ({ ...current, [question._id]: { error: errorMessage(error) } })); } finally { setBusy(''); } };
  return <div className="practice-question-list">{questions.slice(0, 12).map((question, index) => <article className="practice-question-card panel" key={question._id}><div className="practice-question-head"><div className="practice-index">{String(index + 1).padStart(2, '0')}</div><div><Badge tone="neutral">{question.difficulty}</Badge><span>{question.topic || question.type}</span></div><Badge tone={question.type === 'scenario' ? 'amber' : 'blue'}>{question.type}</Badge></div><h3>{question.title}</h3>{question.scenario && <p className="practice-scenario">{question.scenario}</p>}<p>{question.prompt}</p>{question.options?.map((option, optionIndex) => <label className={`practice-option ${Number(answers[question._id]) === optionIndex ? 'selected' : ''} ${responses[question._id] && Number(answers[question._id]) === optionIndex ? responses[question._id].correct ? 'correct' : 'incorrect' : ''}`} key={optionIndex}><input type="radio" name={question._id} checked={Number(answers[question._id]) === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question._id]: optionIndex }))} />{option}</label>)}<div className="practice-card-footer"><span>{question.tags?.join(' · ')}</span><button disabled={answers[question._id] === undefined || busy === question._id} className="button button-primary button-small" onClick={() => submit(question)}>{busy === question._id ? 'Checking…' : responses[question._id] ? 'Try again' : 'Check answer'}<ArrowRight size={14} /></button></div>{responses[question._id]?.correct !== undefined && <div className={`practice-feedback ${responses[question._id].correct ? 'correct' : 'incorrect'}`}><strong>{responses[question._id].correct ? 'That’s right.' : 'Not quite. Review the reasoning.'}</strong><p>{responses[question._id].explanation}</p></div>}{responses[question._id]?.error && <div className="form-alert form-alert-error">{responses[question._id].error}</div>}</article>)}</div>;
}

function CodePractice({ theme }) {
  const [language, setLanguage] = useState('javascript');
  const [source, setSource] = useState('console.log("Hello, world!");');
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chooseLanguage = (event) => {
    const next = event.target.value;
    const starter = {
      javascript: 'console.log("Hello, world!");',
      python: 'print("Hello, world!")',
      java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, world!");\n  }\n}',
      c: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello, world!\\n");\n  return 0;\n}',
      cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, world!\\n";\n  return 0;\n}',
    };
    setLanguage(next);
    setSource(starter[next]);
    setResult(null);
    setError('');
  };

  const execute = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await api.post('/student/compiler/execute', { language, sourceCode: source, stdin });
      setResult(dataOf(response));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return <section className="compiler-workspace panel" aria-label="Online code compiler">
    <div className="compiler-topbar">
      <div><div className="eyebrow">YESGAP CODE LAB</div><h2>Online compiler</h2><p>Write a program, add optional input, and run it.</p></div>
      <label className="language-select"><span>Language</span><select value={language} onChange={chooseLanguage} aria-label="Programming language"><option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="c">C</option><option value="cpp">C++</option></select></label>
    </div>
    <div className="compiler-editor"><CodeMirror value={source} height="min(54vh, 520px)" theme={theme === 'light' ? 'light' : oneDark} extensions={[inlineSuggestion(language), inlineSuggestionKeymap(language), languageExtension(language), autocompletion({ activateOnTyping: true, override: [contextualCompletion(language)] })]} onChange={(value) => { setSource(value); setResult(null); }} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }} /></div>
    <div className="compiler-lower-grid">
      <label className="compiler-stdin"><span>Program input <small>stdin · optional</small></span><textarea value={stdin} onChange={(event) => setStdin(event.target.value)} placeholder="Type input that your program reads..." rows="5" /></label>
      <section className="compiler-output" aria-live="polite"><div className="compiler-output-head"><span>Output</span>{result && <span className={`compiler-status compiler-status-${result.status}`}>{result.status.replaceAll('_', ' ')}</span>}</div>{!result ? <p className="compiler-output-empty">Run your code to see the output here.</p> : <><pre>{result.stdout || (result.status === 'ok' ? '(no output)' : '')}</pre>{result.stderr && <pre className="compiler-stderr">{result.stderr}</pre>}<small>{result.version && `${result.version} · `}{result.durationMs} ms</small></>}</section>
    </div>
    {error && <ErrorNotice message={error} />}
    {busy && <div className="runner-busy"><span className="spin-small" />Compiling and running…</div>}
    <div className="compiler-actions"><span><Sparkles size={14} />Suggestions · press Tab to accept</span><button className="button button-primary" disabled={busy} onClick={execute}><Play size={15} />{busy ? 'Running…' : 'Run code'}</button></div>
  </section>;
}
export function CodingRoundRunner({ session, onClose }) {
  const { user } = useAuth();
  const question = session.question;
  const initialLanguage = question.supportedLanguages?.[0] || 'javascript';
  const [language, setLanguage] = useState(initialLanguage);
  const [source, setSource] = useState(question.starterCode?.[initialLanguage] || '');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
  const roundFinished = ['passed', 'failed'].includes(result?.roundOutcome?.result);
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [session.expiresAt]);
  useEffect(() => {
    if (timeLeft !== 0 || roundFinished) return;
    api.post(`/student/rounds/${session.codingRoundId}/start`).catch(() => undefined);
  }, [timeLeft, roundFinished, session.codingRoundId]);
  const chooseLanguage = (event) => {
    const next = event.target.value;
    setLanguage(next); setSource(question.starterCode?.[next] || ''); setResult(null); setError('');
  };
  const execute = async (kind) => {
    if (busy || roundFinished || timeLeft <= 0) return;
    setBusy(true); setError('');
    try {
      const response = await api.post(`/student/coding/questions/${question._id}/execute`, { language, sourceCode: source, kind, roundId: session.codingRoundId }, { timeout: 65_000 });
      setResult(dataOf(response));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  const clock = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
  return <Modal title={roundFinished ? 'Coding round result' : 'Timed coding challenge'} onClose={onClose}><div className="coding-round-body">
    <div className="coding-round-heading"><div><Badge tone={question.difficulty === 'beginner' ? 'green' : 'amber'}>{question.difficulty}</Badge><span>{question.topic || 'Coding challenge'}</span></div><strong className={timeLeft < 60 ? 'timer-urgent' : ''}><Clock3 size={15} />{clock}</strong></div>
    <h2>{question.title}</h2><p className="coding-round-statement">{question.statement}</p>
    {question.inputSpec && <p><strong>Input:</strong> {question.inputSpec}</p>}{question.outputSpec && <p><strong>Output:</strong> {question.outputSpec}</p>}
    {question.constraints?.length > 0 && <ul className="coding-round-constraints">{question.constraints.map((item) => <li key={item}>{item}</li>)}</ul>}
    {question.examples?.map((example, index) => <div className="problem-example" key={index}><span>Example {index + 1}</span><div><small>Input</small><code>{example.input}</code></div><div><small>Output</small><code>{example.output}</code></div></div>)}
    {error && <ErrorNotice message={error} />}
    {timeLeft <= 0 && <div className="form-alert form-alert-error">Time is up. The server is closing this assessment; close this window to refresh your result.</div>}
    <div className="coding-round-editor"><div className="code-editor-top"><div><div className="eyebrow">YOUR WORKSPACE</div><h3>Write your solution</h3></div><label className="language-select"><span>Language</span><select value={language} onChange={chooseLanguage} disabled={roundFinished || timeLeft <= 0} aria-label="Programming language">{question.supportedLanguages.map((value) => <option value={value} key={value}>{value === 'cpp' ? 'C++' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div>
      <div className="code-editor-viewport"><CodeMirror value={source} height="300px" theme={user?.theme === 'light' ? 'light' : oneDark} extensions={[inlineSuggestion(language), inlineSuggestionKeymap(language), languageExtension(language), autocompletion({ activateOnTyping: true, override: [contextualCompletion(language)] })]} onChange={setSource} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }} editable={!roundFinished && timeLeft > 0} /></div>
      <div className="coding-round-actions"><span><Sparkles size={14} />Suggestions · press Tab to accept</span><div><button className="button button-soft button-small" disabled={busy || roundFinished || timeLeft <= 0} onClick={() => execute('run')}><Play size={14} />Run examples</button><button className="button button-primary button-small" disabled={busy || roundFinished || timeLeft <= 0} onClick={() => execute('submit')}><Send size={14} />Submit final answer</button></div></div>
    </div>
    {busy && <div className="runner-busy"><span className="spin-small" />Submitting to isolated execution…</div>}
    {result && <div className={`execution-result execution-${result.executionStatus}`}><div className="execution-result-head"><strong>{result.roundOutcome?.result ? `Round ${result.roundOutcome.result}` : result.accepted ? 'All tests passed' : result.executionStatus.replaceAll('_', ' ')}</strong><span>{result.passedTests}/{result.totalTests} tests · {result.durationMs} ms</span></div>{result.roundOutcome?.message && <p>{result.roundOutcome.message}</p>}{result.stdout && <pre>{result.stdout}</pre>}{result.stderr && <pre className="execution-stderr">{result.stderr}</pre>}<div className="test-result-list">{result.outcomes?.map((item) => <span key={item.index} className={item.passed ? 'passed' : 'failed'}>{item.hidden ? 'Hidden case' : `Case ${item.index + 1}`}<i>{item.passed ? 'Passed' : 'Failed'}</i></span>)}</div></div>}
    {roundFinished && <button className="button button-primary full-button" onClick={onClose}>Close result<Check size={15} /></button>}
    {!roundFinished && <p className="integrity-note"><Clock3 size={13} />Submitting ends this round. Your code is executed in an isolated service.</p>}
  </div></Modal>;
}

function languageExtension(language) { return ({ javascript: javascript(), python: python(), java: java(), c: cpp(), cpp: cpp(), sql: sql(), html: html(), css: css() }[language] || javascript()); }
function contextualCompletion(language) {
  const common = ['string', 'String', 'console.log', 'print', 'function', 'return', 'const', 'let', 'class', 'async', 'await'];
  const terms = ({ python: ['string', 'str', 'def', 'return', 'for', 'while', 'print', 'list', 'dict', 'class', 'async', 'await'], java: ['String', 'static', 'public', 'private', 'class', 'interface', 'System.out.println', 'return', 'List', 'Map'], c: ['string', 'printf', 'scanf', 'int', 'char', 'long', 'struct', 'return'], cpp: ['string', 'std::cout', 'std::cin', 'int', 'vector', 'class', 'return'], sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY', 'COUNT', 'HAVING'], html: ['section', 'article', 'main', 'label', 'button', 'nav', 'aria-label'], css: ['display: grid', 'display: flex', 'gap', 'grid-template-columns', 'max-width', 'padding'] }[language] || common);
  return (context) => { const word = context.matchBefore(/[\w-]*/); if (!word || word.from === word.to && !context.explicit) return null; const prefix = word.text.toLowerCase(); return { from: word.from, options: terms.filter((term) => !prefix || term.toLowerCase().startsWith(prefix)).map((label) => ({ label, type: 'keyword', boost: label === 'string' || label === 'String' ? 5 : 0 })), validFor: /^[\w-]*$/ }; };
}

class InlineGhostText extends WidgetType {
  constructor(text) { super(); this.text = text; }
  toDOM() { const node = document.createElement('span'); node.className = 'cm-ghost-suggestion'; node.textContent = this.text; return node; }
  eq(other) { return other.text === this.text; }
}

function inlineSuggestionAt(state, language) {
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const line = state.doc.lineAt(selection.head);
  const before = line.text.slice(0, selection.head - line.from);
  const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!match) return null;
  const nodeName = syntaxTree(state).resolveInner(selection.head, -1).name;
  if (/string|comment/i.test(nodeName)) return null;
  const candidates = ({
    javascript: ['string', 'console.log', 'function', 'return', 'const', 'let', 'class', 'async', 'await', 'Array', 'Promise'],
    python: ['string', 'str', 'print', 'def', 'return', 'for', 'while', 'list', 'dict', 'class', 'async', 'await'],
    java: ['String', 'static', 'System.out.println', 'public', 'private', 'class', 'interface', 'return', 'ArrayList'],
    c: ['string', 'printf', 'scanf', 'int', 'char', 'long', 'struct', 'return'],
    cpp: ['string', 'std::cout', 'std::cin', 'int', 'vector', 'class', 'return'],
    sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY', 'COUNT'],
    html: ['section', 'article', 'main', 'label', 'button', 'nav'],
    css: ['display', 'grid-template-columns', 'max-width', 'padding', 'margin'],
  }[language] || ['string', 'console.log', 'function', 'return', 'const', 'let', 'class']);
  const prefix = match[0];
  const full = candidates.find((candidate) => candidate.toLowerCase().startsWith(prefix.toLowerCase()) && candidate.length > prefix.length);
  return full ? { from: selection.head - prefix.length, to: selection.head, full, suffix: full.slice(prefix.length) } : null;
}

function inlineSuggestion(language) {
  return ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.build(view); }
    update(update) { this.decorations = this.build(update.view); }
    build(view) {
      if (!view.hasFocus) return Decoration.none;
      const suggestion = inlineSuggestionAt(view.state, language);
      return suggestion ? Decoration.set([Decoration.widget({ widget: new InlineGhostText(suggestion.suffix), side: 1 }).range(suggestion.to)]) : Decoration.none;
    }
  }, { decorations: (value) => value.decorations });
}

function inlineSuggestionKeymap(language) {
  return keymap.of([{ key: 'Tab', run(view) {
    if (completionStatus(view.state) === 'active') return acceptCompletion(view);
    const suggestion = inlineSuggestionAt(view.state, language);
    if (!suggestion) return false;
    view.dispatch({ changes: { from: suggestion.from, to: suggestion.to, insert: suggestion.full }, selection: { anchor: suggestion.from + suggestion.full.length } });
    return true;
  } }]);
}

function LivePreview({ skill, theme }) {
  const isCss = skill.executionType === 'css-preview'; const [source, setSource] = useState(isCss ? '.card {\n  display: grid;\n  gap: 1rem;\n  padding: 1.5rem;\n  border-radius: 1rem;\n  background: white;\n}' : '<main>\n  <section class="card">\n    <h1>Build your first page</h1>\n    <p>Edit this markup to explore semantic HTML.</p>\n    <button>Get started</button>\n  </section>\n</main>');
  const previewDocument = isCss ? `<style>${source}</style><main><section class="card"><h1>Your live preview</h1><p>Update the styles to see how layout and spacing respond.</p><button>Try the page</button></section></main>` : source;
  const document = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'">${previewDocument}`;
  return <div className="live-preview-grid"><section className="live-editor panel"><div className="code-editor-top"><div><div className="eyebrow">LIVE {isCss ? 'CSS' : 'HTML'} PRACTICE</div><h3>Build and preview</h3></div><Badge tone="green">Sandboxed preview</Badge></div><CodeMirror value={source} height="360px" theme={theme === 'light' ? 'light' : oneDark} extensions={[inlineSuggestion(isCss ? 'css' : 'html'), inlineSuggestionKeymap(isCss ? 'css' : 'html'), isCss ? css() : html(), autocompletion({ override: [contextualCompletion(isCss ? 'css' : 'html')] })]} onChange={setSource} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }} /><div className="editor-note">This preview runs in a sandboxed frame. It cannot read your YESGAP session.</div></section><section className="preview-card panel"><div className="preview-head"><span>LIVE PREVIEW</span><span><i />READY</span></div><iframe title={`${skill.name} live preview`} sandbox="" srcDoc={document} /></section></div>;
}

function AssessmentArea({ skill }) {
  const [difficulty, setDifficulty] = useState('beginner'); const { data, loading, error, reload } = useAssessmentSets(skill._id, difficulty); const [attempt, setAttempt] = useState(null); const [busySet, setBusySet] = useState(''); const [message, setMessage] = useState('');
  const start = async (set) => { setBusySet(String(set.setNumber)); setMessage(''); try { const response = await api.post('/student/assessments/attempts', { skillId: skill._id, difficulty, setNumber: set.setNumber }); setAttempt(dataOf(response)); } catch (reason) { setMessage(errorMessage(reason)); } finally { setBusySet(''); } };
  return <div className="assessment-content"><div className="assessment-intro"><div className="assessment-intro-icon"><FileQuestion size={21} /></div><div><div className="eyebrow">ASSESS YOUR UNDERSTANDING</div><h2>{skill.name} assessments</h2><p>Timed sets use questions from YESGAP’s shared question bank. You can review results and retake any set.</p></div></div><div className="difficulty-switch">{['beginner', 'intermediate', 'advanced'].map((level) => <button key={level} className={difficulty === level ? 'active' : ''} onClick={() => setDifficulty(level)}>{level}</button>)}</div>{message && <ErrorNotice message={message} />}{loading ? <Loading /> : error ? <ErrorNotice message={error} onRetry={reload} /> : data?.sets?.length ? <><div className="set-progress-line"><span>{data.completedSetNumbers?.length || 0} of {data.sets.length} sets completed</span><ProgressBar value={(data.completedSetNumbers?.length || 0) / data.sets.length * 100} /></div><div className="test-set-grid">{data.sets.map((set) => { const done = data.completedSetNumbers?.includes(set.setNumber); return <article className={`test-set-card ${done ? 'set-complete' : ''}`} key={set._id}><div className="test-set-top"><span className="test-set-number">{String(set.setNumber).padStart(2, '0')}</span>{done ? <Badge tone="green">Completed</Badge> : <Badge tone="neutral">New</Badge>}</div><h3>{set.title || `Set ${set.setNumber}`}</h3><div className="test-set-meta"><span><FileQuestion size={13} />{set.questionCount} questions</span><span><Clock3 size={13} />{set.durationMinutes} min</span></div><button className={`button ${done ? 'button-soft' : 'button-primary'} full-button`} disabled={busySet === String(set.setNumber)} onClick={() => start(set)}>{busySet === String(set.setNumber) ? 'Preparing…' : done ? 'Retake set' : 'Start assessment'}<ArrowRight size={14} /></button></article>; })}</div></> : <EmptyState icon={FileQuestion} title="Assessments are being prepared" description={`There are no ${difficulty} question sets for this skill yet.`} />}{attempt && <AssessmentRunner attempt={attempt} onClose={() => { setAttempt(null); reload(); }} />}</div>;
}

function useAssessmentSets(skillId, difficulty) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const load = async () => { setState({ data: null, loading: true, error: '' }); try { setState({ data: dataOf(await api.get(`/student/assessments/${skillId}/sets?difficulty=${difficulty}`)), loading: false, error: '' }); } catch (error) { setState({ data: null, loading: false, error: errorMessage(error) }); } };
  useEffect(() => { load(); }, [skillId, difficulty]);
  return { ...state, reload: load };
}

export function AssessmentRunner({ attempt, onClose }) {
  const [index, setIndex] = useState(0); const [selected, setSelected] = useState({}); const [result, setResult] = useState(null); const [revealed, setRevealed] = useState({}); const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const questionStartedAt = useRef(Date.now());
  const attemptId = attempt.attemptId;
  useEffect(() => {
    if (result) return undefined;
    const timer = setInterval(() => setTimeLeft(Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [attempt.expiresAt, result]);
  useEffect(() => {
    if (result) return undefined;
    let lastAt = 0;
    const record = () => { if (Date.now() - lastAt < 1000) return; lastAt = Date.now(); api.post(`/student/assessments/attempts/${attemptId}/tab-switch`).catch(() => undefined); };
    const onVisibility = () => { if (document.hidden) record(); };
    window.addEventListener('blur', record); document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('blur', record); document.removeEventListener('visibilitychange', onVisibility); };
  }, [attemptId, result]);
  useEffect(() => { if (timeLeft === 0 && !result && !busy) submit(); }, [timeLeft]);
  const questions = attempt.questions || []; const current = questions[index];
  const saveAnswer = async (questionIndex, selectedIndex, skipped = false, timeSpentSec = 0) => { await api.patch(`/student/assessments/attempts/${attemptId}/answer`, { index: questionIndex, selectedIndex, skipped, timeSpentSec }); };
  const choose = (option) => setSelected((currentState) => ({ ...currentState, [index]: option }));
  const move = async (next) => { try { if (selected[index] !== undefined) await saveAnswer(index, selected[index], false, Math.min(600, Math.round((Date.now() - questionStartedAt.current) / 1000))); else await saveAnswer(index, null, true, Math.min(600, Math.round((Date.now() - questionStartedAt.current) / 1000))); setIndex(Math.max(0, Math.min(questions.length - 1, next))); questionStartedAt.current = Date.now(); } catch (reason) { setError(errorMessage(reason)); } };
  const revealAnswer = async () => { try { const response = await api.post(`/student/assessments/attempts/${attemptId}/reveal/${index}`); setRevealed((currentState) => ({ ...currentState, [index]: dataOf(response) })); } catch (reason) { setError(errorMessage(reason)); } };
  const submit = async () => {
    if (busy || result) return; setBusy(true); setError('');
    try { if (Date.now() < new Date(attempt.expiresAt).getTime()) { for (let answerIndex = 0; answerIndex < questions.length; answerIndex += 1) { const currentQuestionTime = answerIndex === index ? Math.min(600, Math.round((Date.now() - questionStartedAt.current) / 1000)) : 0; await saveAnswer(answerIndex, selected[answerIndex] ?? null, selected[answerIndex] === undefined, currentQuestionTime); } } const response = await api.post(`/student/assessments/attempts/${attemptId}/submit`); setResult(dataOf(response)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  const close = async () => { if (!result) await api.post(`/student/assessments/attempts/${attemptId}/abandon`).catch(() => undefined); onClose(); };
  const clock = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
  return <Modal title={result ? 'Assessment result' : 'Timed assessment'} onClose={close}><div className="assessment-runner">{result ? <><div className="attempt-result-hero"><div className={`attempt-result-score ${result.percentage >= 70 ? 'result-strong' : 'result-needs-work'}`}><strong>{result.percentage}%</strong><span>{result.correct} correct of {result.totalQuestions}</span></div><div><div className="eyebrow">YOUR RESULT</div><h2>{result.percentage >= 70 ? 'Strong understanding' : 'Keep building your foundation'}</h2><p>You completed this set in {Math.round(result.timeTakenSec / 60)} minutes. Review each answer and topics to focus on.</p></div></div><div className="result-breakdown"><span><CheckCircle2 size={14} />{result.correct} correct</span><span><X size={14} />{result.wrong} wrong</span><span>{result.skipped} skipped</span><span>{result.tabSwitchCount || 0} focus changes</span></div>{result.weakTopics?.length > 0 && <div className="weak-topics"><strong>Topics to review</strong>{result.weakTopics.map((topic) => <Badge tone="amber" key={topic}>{topic}</Badge>)}</div>}<div className="answer-review-list">{result.answers?.map((answer, answerIndex) => <article key={answerIndex} className={`answer-review ${answer.isCorrect ? 'answer-correct' : 'answer-incorrect'}`}><div className="answer-review-head"><Badge tone={answer.isCorrect ? 'green' : 'rose'}>Question {answerIndex + 1} · {answer.isCorrect ? 'Correct' : answer.selectedIndex == null ? 'Skipped' : 'Review'}</Badge><span>{answer.topic}</span></div><strong>{answer.prompt}</strong><p>Your answer: {answer.selectedIndex == null ? 'Skipped' : answer.options[answer.selectedIndex]}</p><p>Correct answer: {answer.options[answer.correctIndex]}</p>{answer.revealed && <small>Answer was revealed during the attempt.</small>}</article>)}</div><button className="button button-primary full-button" onClick={close}>Close result<Check size={15} /></button></> : <>{error && <ErrorNotice message={error} />}<div className="assessment-runner-bar"><span>Question {index + 1} of {questions.length}</span><ProgressBar value={(index + 1) / questions.length * 100} /><strong className={timeLeft < 60 ? 'timer-urgent' : ''}><Clock3 size={15} />{clock}</strong></div>{current && <section className="active-question"><div className="active-question-meta"><Badge tone="blue">{current.topic || 'General'}</Badge><button className="text-button" onClick={revealAnswer}>Show answer</button></div><h3>{current.prompt}</h3><div className="assessment-options">{current.options.map((option, optionIndex) => <label className={`assessment-option ${selected[index] === optionIndex ? 'selected' : ''}`} key={optionIndex}><input type="radio" name={`question-${index}`} checked={selected[index] === optionIndex} onChange={() => choose(optionIndex)} /><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>{option}</label>)}</div>{revealed[index] && <div className="answer-revealed">The correct answer is option {String.fromCharCode(65 + revealed[index].correctIndex)}. {revealed[index].explanation}</div>}</section>}<div className="question-pagination">{questions.map((_item, questionIndex) => <button key={questionIndex} className={`${index === questionIndex ? 'active' : ''} ${selected[questionIndex] !== undefined ? 'answered' : ''}`} onClick={() => move(questionIndex)} aria-label={`Go to question ${questionIndex + 1}`}>{questionIndex + 1}</button>)}</div><div className="assessment-runner-footer"><button className="button button-quiet" onClick={() => move(index - 1)} disabled={index === 0 || busy}><ArrowLeft size={14} />Previous</button><button className="button button-soft" onClick={() => move(index + 1)} disabled={index === questions.length - 1 || busy}>Skip<ArrowRight size={14} /></button>{index === questions.length - 1 ? <button className="button button-primary" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit assessment'}<Send size={14} /></button> : <button className="button button-primary" onClick={() => move(index + 1)}>Save & continue<ArrowRight size={14} /></button>}</div><p className="integrity-note"><Clock3 size={13} />Your timer is active. Leaving this window is recorded during the attempt.</p></>}</div></Modal>;
}
