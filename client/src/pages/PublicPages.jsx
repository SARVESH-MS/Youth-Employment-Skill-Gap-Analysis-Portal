import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpenCheck, BriefcaseBusiness, ChartNoAxesCombined, Check, Compass, GraduationCap, Layers3, LockKeyhole, Sparkles, UsersRound } from 'lucide-react';
import { motion } from 'framer-motion';
import api, { dataOf, errorMessage } from '../api/client';
import { useAuth } from '../app/AuthContext';
import { Field, FormInput, FormSelect, Loading } from '../components/Common';

const highlights = [
  { icon: ChartNoAxesCombined, title: 'Know your next step', text: 'See how your current skills line up with a career path and focus your time where it counts.' },
  { icon: BookOpenCheck, title: 'Learn by doing', text: 'Use guided lessons, practice, and assessments that turn concepts into evidence of progress.' },
  { icon: BriefcaseBusiness, title: 'Meet the right teams', text: 'Discover opportunities and share your profile with companies on your terms.' },
];

export function LandingPage() {
  return <main className="public-shell">
    <nav className="public-nav"><Link to="/" className="brand"><span className="brand-mark">Y</span><span>YESGAP<small>YOUTH EMPLOYMENT</small></span></Link><div className="public-nav-links"><a href="#how-it-works">How it works</a><a href="#domains">Career paths</a><Link to="/login" className="nav-signin">Sign in</Link><Link to="/register/student" className="button button-primary button-small">Get started<ArrowRight size={15} /></Link></div><Link to="/login" className="mobile-signin">Sign in</Link></nav>
    <section className="hero-wrap">
      <div className="hero-copy"><div className="pill"><Sparkles size={14} />A clearer path into tech</div><h1>Build your skills.<br /><em>Find your next role.</em></h1><p className="hero-lede">A practical place to see what you know, learn what you need, and connect with teams looking for your potential.</p><div className="hero-actions"><Link to="/register/student" className="button button-primary button-large">Start your journey<ArrowRight size={17} /></Link><a href="#how-it-works" className="button button-quiet button-large">Explore the platform<ArrowUpRight size={17} /></a></div><div className="hero-proof"><div className="avatar-stack"><span>AS</span><span>RK</span><span>NP</span><span>+60</span></div><div><strong>Built for your next step</strong><small>Learn, show your progress, and grow with confidence.</small></div></div></div>
      <div className="hero-visual" aria-label="YESGAP skill progress dashboard illustration"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-window"><div className="hero-window-head"><span className="window-dots"><i /><i /><i /></span><span>My career readiness</span><span className="hero-live"><i /> LIVE</span></div><div className="hero-readiness"><div><span className="eyebrow">FULL STACK DEVELOPMENT</span><strong>72<small>%</small></strong><span className="readiness-change">↑ 8% this month</span></div><div className="readiness-ring"><div><strong>72</strong><small>READY</small></div></div></div><div className="hero-progress-card"><div className="mini-card-head"><span>Your skills</span><small>7 of 10 on track</small></div><div className="skill-line"><span><i className="skill-dot complete" /> HTML</span><b>Strong</b><div className="mini-meter"><i style={{ width: '100%' }} /></div></div><div className="skill-line"><span><i className="skill-dot complete" /> JavaScript</span><b>Strong</b><div className="mini-meter"><i style={{ width: '89%' }} /></div></div><div className="skill-line"><span><i className="skill-dot in-progress" /> React</span><b>In progress</b><div className="mini-meter"><i style={{ width: '52%' }} /></div></div><div className="skill-line"><span><i className="skill-dot missing" /> Node.js</span><b>Up next</b><div className="mini-meter"><i style={{ width: '18%' }} /></div></div></div><div className="hero-float-note"><div className="float-check"><Check size={15} /></div><span><strong>Nice work, Asha</strong><small>3 learning days in a row</small></span><span className="float-streak">✦ 3</span></div><div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div></div></div>
    </section>
    <section className="trust-strip"><span>ONE WORKSPACE FOR YOUR CAREER JOURNEY</span><div><span><GraduationCap size={18} /> Learn with direction</span><i /><span><Layers3 size={18} /> Build real skills</span><i /><span><UsersRound size={18} /> Connect with employers</span></div></section>
    <section className="section-pad landing-features" id="how-it-works"><div className="section-intro"><div className="eyebrow">A path that makes sense</div><h2>From “where do I start?”<br /><em>to “I’m ready.”</em></h2><p>Keep your learning connected to the roles you want, with a clear view of what is improving and what comes next.</p></div><div className="feature-grid">{highlights.map((item, index) => <motion.article className="feature-card" key={item.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ delay: index * 0.08 }}><div className={`feature-icon feature-icon-${index}`}><item.icon size={21} /></div><h3>{item.title}</h3><p>{item.text}</p><span className="feature-index">0{index + 1}</span></motion.article>)}</div></section>
    <section className="path-section" id="domains"><div className="path-art"><div className="path-blob"><Compass size={116} strokeWidth={1.1} /></div><span className="path-label label-left">Frontend</span><span className="path-label label-right">Cloud</span><span className="path-label label-bottom">Data & AI</span><div className="path-stamp">YOUR<br />PACE<span>↗</span></div></div><div className="path-copy"><div className="eyebrow">Room to grow</div><h2>A career path that starts <em>with you.</em></h2><p>Explore technology domains, understand the skills employers ask for, and build a roadmap that fits your current experience.</p><div className="path-list"><div><span>01</span><p><strong>Choose a direction</strong><small>See what different roles have in common.</small></p></div><div><span>02</span><p><strong>Learn in one place</strong><small>Keep lessons, practice, and progress together.</small></p></div><div><span>03</span><p><strong>Show your growth</strong><small>Share a clear, skill-based profile with employers.</small></p></div></div><Link className="text-link" to="/register/student">Explore career paths <ArrowRight size={16} /></Link></div></section>
    <section className="cta-section"><div><div className="eyebrow">Your next step can start today</div><h2>Make your potential<br /><em>visible.</em></h2><p>Build a steady, practical path from where you are to where you want to go.</p><Link className="button button-dark button-large" to="/register/student">Create your free profile<ArrowRight size={17} /></Link></div><div className="cta-decoration"><div className="cta-card cta-card-back">LEARNING PATH <span>↗</span><i /><i /><i /></div><div className="cta-card cta-card-front"><span className="cta-star">✦</span><small>YOUR NEXT SKILL</small><strong>React</strong><span className="cta-card-pill">Recommended</span></div><div className="cta-ring" /></div></section>
    <footer className="public-footer"><Link to="/" className="brand"><span className="brand-mark">Y</span><span>YESGAP<small>YOUTH EMPLOYMENT</small></span></Link><p>Helping young people move forward in technology.</p><div><Link to="/register/company">For companies</Link><Link to="/login">Sign in</Link><span>© 2026 YESGAP</span></div></footer>
  </main>;
}

export function AuthPage({ mode = 'login' }) {
  const { role: routeRole } = useParams();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [role, setRole] = useState(['student', 'company', 'admin'].includes(routeRole) ? routeRole : 'student');
  const [catalog, setCatalog] = useState({ domains: [], skills: [] });
  const [loadingCatalog, setLoadingCatalog] = useState(mode === 'register');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [values, setValues] = useState({});
  const isRegister = mode === 'register';

  useEffect(() => {
    if (!isRegister) return;
    Promise.all([api.get('/catalog/domains'), api.get('/catalog/skills')]).then(([domains, skills]) => setCatalog({ domains: dataOf(domains), skills: dataOf(skills) })).catch((reason) => setError(errorMessage(reason))).finally(() => setLoadingCatalog(false));
  }, [isRegister]);
  useEffect(() => {
    if (isRegister && !['student', 'company'].includes(routeRole)) navigate('/login', { replace: true });
  }, [isRegister, routeRole, navigate]);
  const skillOptions = useMemo(() => catalog.skills, [catalog.skills]);
  const toggleSkill = (skillId, field = role === 'company' ? 'requiredSkills' : 'skills') => setValues((current) => ({ ...current, [field]: (current[field] || []).includes(skillId) ? current[field].filter((value) => value !== skillId) : [...(current[field] || []), skillId] }));
  const setValue = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true);
    try {
      if (isRegister) {
        if (values.password !== values.confirmPassword) throw new Error('Your passwords do not match.');
        const payload = role === 'student' ? {
          fullName: values.fullName, username: values.username, email: values.email, phone: values.phone,
          password: values.password, confirmPassword: values.confirmPassword, domainId: values.domainId,
          skills: values.skills || [], education: { twelfth: { stream: values.stream }, undergraduate: { degree: values.degree, specialization: values.specialization, college: values.college, cgpa: values.cgpa ? Number(values.cgpa) : undefined, startYear: values.startYear ? Number(values.startYear) : undefined, graduationYear: values.graduationYear ? Number(values.graduationYear) : undefined } },
          spokenLanguages: (values.languages || 'English').split(',').map((language) => ({ language: language.trim(), proficiency: 'conversational' })).filter((language) => language.language),
        } : {
          companyName: values.companyName, fullName: values.fullName, username: values.username,
          email: values.email, phone: values.phone, password: values.password,
          designation: values.designation, industry: values.industry, description: values.description,
          website: values.website, location: values.location, expectedCompensation: values.expectedCompensation,
          expectedHires: values.expectedHires ? Number(values.expectedHires) : undefined,
          hiringRequirements: values.hiringRequirements, requiredSkills: values.requiredSkills || [],
        };
        const user = await register(role, payload);
        if (user.role === 'company') setSuccess('Your company account is pending admin approval. You can return here to sign in once it is approved.');
      } else {
        const user = await login({ identifier: values.identifier, password: values.password, role });
        navigate(`/${user.role}/dashboard`, { replace: true });
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };

  return <main className="auth-shell"><div className="auth-visual"><Link to="/" className="brand brand-on-dark"><span className="brand-mark">Y</span><span>YESGAP<small>YOUTH EMPLOYMENT</small></span></Link><div className="auth-visual-content"><div className="eyebrow">A practical path into technology</div><h1>Grow into the<br /><em>work you want.</em></h1><p>Build a skill plan that makes your next move easier to see.</p><div className="auth-quote-card"><span>“</span><p>Every project starts with one small step. Keep going, and your progress will speak for you.</p><small>THE YESGAP APPROACH</small></div></div><span className="auth-visual-foot">LEARN · PRACTICE · MOVE FORWARD</span><div className="auth-visual-shape" /></div><section className="auth-panel"><div className="auth-panel-top"><Link to="/" className="brand mobile-brand"><span className="brand-mark">Y</span><span>YESGAP<small>YOUTH EMPLOYMENT</small></span></Link><span>Already have an account? <Link to="/login">Sign in</Link></span></div><div className="auth-form-wrap"><div className="eyebrow">{isRegister ? 'Create your workspace' : 'Welcome back'}</div><h2>{isRegister ? `Join as a ${role}` : 'Sign in to YESGAP'}</h2><p>{isRegister ? 'Set up a profile that grows with your work.' : 'Continue building toward your next opportunity.'}</p>
      {isRegister && <div className="account-type-switch" role="tablist" aria-label="Account type">{['student', 'company'].map((item) => <button key={item} type="button" role="tab" aria-selected={role === item} className={role === item ? 'active' : ''} onClick={() => { setRole(item); setError(''); }}>{item === 'student' ? 'Student' : 'Company'}</button>)}</div>}
      {!isRegister && <div className="account-type-switch" role="tablist" aria-label="Sign-in role">{['student', 'company', 'admin'].map((item) => <button key={item} type="button" role="tab" aria-selected={role === item} className={role === item ? 'active' : ''} onClick={() => setRole(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>}
      {loadingCatalog ? <Loading label="Loading career catalog…" /> : <form className="auth-form" onSubmit={onSubmit}>
        {isRegister && <>
          {role === 'company' && <Field label="Company name"><FormInput required name="companyName" value={values.companyName || ''} onChange={setValue} placeholder="e.g. Northstar Labs" autoComplete="organization" /></Field>}
          <div className="form-grid"><Field label={role === 'company' ? 'Your name' : 'Full name'}><FormInput required name="fullName" value={values.fullName || ''} onChange={setValue} placeholder="Name as you use professionally" autoComplete="name" /></Field><Field label="Username"><FormInput required name="username" value={values.username || ''} onChange={setValue} placeholder="Choose a username" autoComplete="username" /></Field></div>
          <div className="form-grid"><Field label="Work or personal email"><FormInput required type="email" name="email" value={values.email || ''} onChange={setValue} placeholder="you@example.com" autoComplete="email" /></Field><Field label="Phone number"><FormInput required name="phone" value={values.phone || ''} onChange={setValue} placeholder="Include country code" autoComplete="tel" /></Field></div>
          {role === 'student' ? <>
            <Field label="Career direction"><FormSelect required name="domainId" value={values.domainId || ''} onChange={setValue}><option value="">Choose a career path</option>{catalog.domains.map((domain) => <option key={domain._id} value={domain._id}>{domain.name}</option>)}</FormSelect></Field>
            <Field label="Skills you already know" hint="Choose from the shared YESGAP skills catalog. You can update this later."><div className="skill-select-grid">{skillOptions.slice(0, 12).map((skill) => <button type="button" key={skill._id} className={`skill-select-chip ${(values.skills || []).includes(skill._id) ? 'selected' : ''}`} onClick={() => toggleSkill(skill._id)}>{(values.skills || []).includes(skill._id) ? <Check size={13} /> : <span className="chip-dot" />}{skill.name}</button>)}</div></Field>
            <details className="optional-fields"><summary>Add education details <span>Optional</span></summary><div className="form-grid"><Field label="Current degree"><FormInput name="degree" value={values.degree || ''} onChange={setValue} placeholder="B.Tech, BCA, B.Sc…" /></Field><Field label="Specialization"><FormInput name="specialization" value={values.specialization || ''} onChange={setValue} placeholder="Computer Science" /></Field></div><div className="form-grid"><Field label="College"><FormInput name="college" value={values.college || ''} onChange={setValue} placeholder="College or university" /></Field><Field label="CGPA (out of 10)"><FormInput type="number" min="0" max="10" step="0.01" name="cgpa" value={values.cgpa || ''} onChange={setValue} placeholder="8.0" /></Field></div><div className="form-grid"><Field label="College start year"><FormInput type="number" name="startYear" value={values.startYear || ''} onChange={setValue} placeholder="2022" /></Field><Field label="Graduation year"><FormInput type="number" name="graduationYear" value={values.graduationYear || ''} onChange={setValue} placeholder="2026" /></Field></div><Field label="Languages you speak"><FormInput name="languages" value={values.languages || 'English'} onChange={setValue} placeholder="English, Hindi" /></Field></details>
          </> : <>
            <div className="form-grid"><Field label="Your designation"><FormInput name="designation" value={values.designation || ''} onChange={setValue} placeholder="Talent partner" /></Field><Field label="Industry"><FormInput name="industry" value={values.industry || ''} onChange={setValue} placeholder="Software products" /></Field></div>
            <div className="form-grid"><Field label="Location"><FormInput name="location" value={values.location || ''} onChange={setValue} placeholder="Bengaluru, India" /></Field><Field label="Company website"><FormInput name="website" value={values.website || ''} onChange={setValue} placeholder="https://company.com" /></Field></div>
            <Field label="About the company"><textarea required className="input textarea" rows="2" name="description" value={values.description || ''} onChange={setValue} placeholder="What your team builds and how it works" /></Field>
            <div className="form-grid"><Field label="Expected compensation"><FormInput name="expectedCompensation" value={values.expectedCompensation || ''} onChange={setValue} placeholder="₹6–10 LPA" /></Field><Field label="Expected hires"><FormInput type="number" min="0" name="expectedHires" value={values.expectedHires || ''} onChange={setValue} placeholder="5" /></Field></div>
            <Field label="Hiring requirements"><textarea className="input textarea" rows="2" name="hiringRequirements" value={values.hiringRequirements || ''} onChange={setValue} placeholder="Experience, education or project expectations" /></Field>
            <Field label="Skills you hire for" hint="These are exact matches from the shared skills catalog."><div className="skill-select-grid">{skillOptions.map((skill) => <button type="button" key={skill._id} className={`skill-select-chip ${(values.requiredSkills || []).includes(skill._id) ? 'selected' : ''}`} onClick={() => toggleSkill(skill._id)}>{(values.requiredSkills || []).includes(skill._id) ? <Check size={13} /> : <span className="chip-dot" />}{skill.name}</button>)}</div></Field>
          </>}
        </>}
        {!isRegister && <Field label="Email, phone, or username"><FormInput required name="identifier" value={values.identifier || ''} onChange={setValue} placeholder="Your sign-in details" autoComplete="username" /></Field>}
        {isRegister ? <div className="form-grid"><Field label="Password"><FormInput required type="password" minLength="10" name="password" value={values.password || ''} onChange={setValue} placeholder="At least 10 characters" autoComplete="new-password" /></Field><Field label="Confirm password"><FormInput required type="password" name="confirmPassword" value={values.confirmPassword || ''} onChange={setValue} placeholder="Enter it again" autoComplete="new-password" /></Field></div> : <Field label="Password"><FormInput required type="password" name="password" value={values.password || ''} onChange={setValue} placeholder="Your password" autoComplete="current-password" /></Field>}
        {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}{success && <div className="form-alert form-alert-success" role="status">{success}</div>}
        <button className="button button-primary button-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create your account' : 'Sign in'}{!busy && <ArrowRight size={17} />}</button>
        {!isRegister && <div className="demo-credentials"><LockKeyhole size={15} /><span><strong>Demo access</strong> Student: <code>demo-student-001</code> · Company: <code>demo-company-001</code> · Password: <code>Demo@12345</code></span></div>}
      </form>}
      <div className="auth-bottom">{isRegister ? <>Already registered? <Link to="/login">Sign in instead</Link></> : <>New to YESGAP? <Link to="/register/student">Create a student profile</Link></>}</div></div><div className="auth-legal">By continuing, you agree to use the platform respectfully and keep account details private.</div></section></main>;
}
