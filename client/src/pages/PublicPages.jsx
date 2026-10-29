import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpenCheck, Brain, BriefcaseBusiness, ChartNoAxesCombined, Check, Cloud, Code2, Compass, Database, GraduationCap, Layers3, LockKeyhole, MoveDown, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import api, { dataOf, errorMessage } from '../api/client';
import { useAuth } from '../app/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { Field, FormInput, FormSelect, Loading } from '../components/Common';
import ThemePicker from '../components/ThemePicker';

const journeySteps = [
  { icon: Compass, number: '01', title: 'Choose a direction', text: 'Explore technology careers and see the skills connected to each path.' },
  { icon: BookOpenCheck, number: '02', title: 'Learn with purpose', text: 'Use guided materials and practice that connect to your next skill.' },
  { icon: ChartNoAxesCombined, number: '03', title: 'Build evidence', text: 'Let lessons and assessments show what is getting stronger over time.' },
  { icon: BriefcaseBusiness, number: '04', title: 'Meet opportunity', text: 'Share your profile with participating teams and manage applications.' },
];

const careerDomains = [
  { icon: Code2, title: 'Frontend development', label: 'DESIGN THE EXPERIENCE', text: 'Build accessible, responsive interfaces for the web.', skills: ['HTML & CSS', 'JavaScript', 'React'], tone: 'mint' },
  { icon: Database, title: 'Backend engineering', label: 'POWER THE PRODUCT', text: 'Create APIs, services, and the data systems behind applications.', skills: ['Node.js', 'REST APIs', 'MongoDB'], tone: 'blue' },
  { icon: Brain, title: 'Data & AI', label: 'FIND THE SIGNAL', text: 'Use data and machine learning to answer useful questions.', skills: ['Python', 'SQL', 'Analytics'], tone: 'amber' },
  { icon: Cloud, title: 'Cloud & security', label: 'KEEP SYSTEMS READY', text: 'Understand reliable infrastructure, networks, and security basics.', skills: ['Linux', 'Cloud basics', 'Security'], tone: 'violet' },
];

export function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.add('landing-page-active');
    const revealItems = document.querySelectorAll('.yg-reveal');
    const animatedSections = document.querySelectorAll('.yg-cinematic-hero, .yg-journey-section, .yg-domains-section, .yg-roadmap-section, .yg-employer-section, .yg-final-section');
    let observer;
    let sectionObserver;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealItems.forEach((item) => item.classList.add('is-revealed'));
      animatedSections.forEach((section) => section.classList.add('is-in-view'));
    } else {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.18, rootMargin: '0px 0px -24px 0px' });
      revealItems.forEach((item) => observer.observe(item));
      sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.target.classList.toggle('is-in-view', entry.isIntersecting));
      }, { rootMargin: '220px 0px' });
      animatedSections.forEach((section) => sectionObserver.observe(section));
    }
    return () => {
      observer?.disconnect();
      sectionObserver?.disconnect();
      animatedSections.forEach((section) => section.classList.remove('is-in-view'));
      document.documentElement.classList.remove('landing-page-active');
    };
  }, []);

  return <main className="public-shell yg-home">
    <nav className="public-nav yg-overlay-nav"><BrandLogo className="landing-brand" variant="inverse" /><div className="public-nav-links"><a href="#how-it-works">How it works</a><a href="#domains">Career paths</a><ThemePicker compact /><Link to="/login" className="nav-signin">Sign in</Link><Link to="/register/student" className="button button-primary button-small">Get started<ArrowRight size={15} /></Link></div><Link to="/login" className="mobile-signin">Sign in</Link></nav>
    <section className="hero-wrap yg-cinematic-hero">
      <div className="hero-copy"><div className="pill"><Sparkles size={14} />A clearer path into tech</div><h1>Build your skills.<br /><em>Find your next role.</em></h1><p className="hero-lede">A practical place to see what you know, learn what you need, and connect with teams looking for your potential.</p><div className="hero-actions"><Link to="/register/student" className="button button-primary button-large">Start your journey<ArrowRight size={17} /></Link><a href="#how-it-works" className="button button-quiet button-large">Explore the platform<ArrowUpRight size={17} /></a></div><div className="hero-proof"><div className="avatar-stack"><span>AS</span><span>RK</span><span>NP</span><span>+60</span></div><div><strong>Built for your next step</strong><small>Learn, show your progress, and grow with confidence.</small></div></div></div>
      <div className="hero-visual yg-immersive-world" role="img" aria-label="Animated landscape with a glowing gateway built from skill modules">
        <div className="yg-world-haze" />
        <svg className="yg-landscape-svg" viewBox="0 0 1440 860" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="ygSky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--scene-sky-start)" /><stop offset=".54" stopColor="var(--scene-sky-mid)" /><stop offset="1" stopColor="var(--scene-sky-end)" /></linearGradient>
            <linearGradient id="ygFarRidge" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--scene-ridge-high)" stopOpacity=".37" /><stop offset="1" stopColor="var(--scene-ridge-low)" stopOpacity=".12" /></linearGradient>
            <linearGradient id="ygGround" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--scene-ground-high)" stopOpacity=".6" /><stop offset="1" stopColor="var(--scene-ground-low)" /></linearGradient>
            <linearGradient id="ygTileTop" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c8d4c9" /><stop offset="1" stopColor="#74877b" /></linearGradient>
            <linearGradient id="ygTileLeft" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#64776d" /><stop offset="1" stopColor="#334640" /></linearGradient>
            <linearGradient id="ygTileRight" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#445950" /><stop offset="1" stopColor="#1f302c" /></linearGradient>
            <radialGradient id="ygPortalLight"><stop stopColor="var(--scene-portal-core)" stopOpacity=".98" /><stop offset=".23" stopColor="var(--scene-glow)" stopOpacity=".65" /><stop offset="1" stopColor="var(--scene-glow)" stopOpacity="0" /></radialGradient>
            <filter id="ygPortalBlur"><feGaussianBlur stdDeviation="18" /></filter>
            <filter id="ygSoftShadow"><feGaussianBlur stdDeviation="9" /></filter>
          </defs>
          <rect width="1440" height="860" fill="url(#ygSky)" />
          <circle cx="930" cy="390" r="250" fill="url(#ygPortalLight)" opacity=".66" />
          <g className="yg-stage-stars" fill="#e7eee3">
            <circle cx="248" cy="161" r="1.6" /><circle cx="378" cy="266" r="1.2" /><circle cx="512" cy="128" r="1.5" /><circle cx="660" cy="221" r="1" /><circle cx="812" cy="146" r="1.6" /><circle cx="1118" cy="153" r="1.2" /><circle cx="1256" cy="294" r="1.7" /><circle cx="1163" cy="548" r="1.2" /><circle cx="541" cy="560" r="1.3" /><circle cx="332" cy="461" r="1.1" />
          </g>
          <path className="yg-far-land" d="M0 495 90 420 160 439 264 323 352 415 446 303 525 389 638 260 744 390 822 311 914 387 1013 270 1125 409 1228 315 1350 418 1440 363 1440 860 0 860Z" fill="url(#ygFarRidge)" />
          <path className="yg-front-land" d="M0 564 122 516 228 545 356 451 485 535 597 473 710 513 822 458 942 504 1077 447 1207 508 1330 438 1440 474 1440 860 0 860Z" fill="url(#ygGround)" />
          <g className="yg-terrain-contours" fill="none" stroke="#b4c2b0" strokeOpacity=".19">
            <path d="M-30 585C148 476 248 594 409 518s243-67 349-13 194 68 330-27 217-115 380-80" />
            <path d="M-30 614C148 505 248 623 409 547s243-67 349-13 194 68 330-27 217-115 380-80" />
            <path d="M-30 644C148 535 248 653 409 577s243-67 349-13 194 68 330-27 217-115 380-80" />
            <path d="M-30 674C148 565 248 683 409 607s243-67 349-13 194 68 330-27 217-115 380-80" />
            <path d="M93 823c96-112 200-172 327-146s197 59 319-1 172-158 323-163 237 48 410-90" />
            <path d="M128 845c96-112 200-172 327-146s197 59 319-1 172-158 323-163 237 48 410-90" />
          </g>
          <g className="yg-perspective-grid" fill="none" stroke="#c0d0c2">
            <path d="M0 860 690 476M180 860 740 472M360 860 790 466M540 860 835 461M720 860 880 458M900 860 925 456M1080 860 970 458M1260 860 1015 461M1440 860 1060 466" />
            <path d="M0 585H1440M0 625H1440M0 675H1440M0 738H1440M0 812H1440" />
          </g>
          <path className="yg-career-trail-glow" d="M55 755C228 700 362 701 508 638s236-88 326-118 151-38 195-103 84-121 172-169" />
          <path className="yg-career-trail" d="M55 755C228 700 362 701 508 638s236-88 326-118 151-38 195-103 84-121 172-169" />
          <g className="yg-trail-points"><circle cx="202" cy="713" r="5" /><circle cx="511" cy="638" r="5" /><circle cx="834" cy="525" r="7" /><circle cx="1024" cy="435" r="5" /><circle cx="1201" cy="365" r="5" /></g>
          <ellipse cx="935" cy="555" rx="228" ry="47" fill="#101916" opacity=".72" filter="url(#ygSoftShadow)" />
          <ellipse cx="935" cy="548" rx="202" ry="29" fill="#bdd4c2" opacity=".16" />
          <path className="yg-gateway-aura" d="M852 541V424a83 83 0 0 1 166 0v117" />
          <path className="yg-gateway-beam" d="M935 526V425" />
          <path className="yg-gateway-arch" d="M852 535V424a83 83 0 0 1 166 0v111" />
          <g className="yg-module-stack">
            {[[770,520],[830,520],[890,520],[950,520],[1010,520],[1070,520],[770,475],[830,475],[1010,475],[1070,475],[770,430],[830,430],[1010,430],[1070,430],[790,385],[850,385],[990,385],[1050,385],[820,340],[880,340],[940,340],[1000,340],[850,295],[910,295],[970,295],[880,250],[940,250]].map(([x, y], index) => (
              <g key={index} className={'yg-portal-block yg-tile-tone-' + (index % 4)} transform={'translate(' + x + ' ' + y + ')'} style={{ animationDelay: (index * 0.075) + 's' }}>
                <path className="yg-tile-top" d="M0 0 29-17 58 0 29 17Z" />
                <path className="yg-tile-left" d="M0 0 29 17V47L0 30Z" />
                <path className="yg-tile-right" d="M29 17 58 0V30L29 47Z" />
                <path className="yg-tile-edge" d="M0 0 29-17 58 0 58 30 29 47 0 30Z" />
              </g>
            ))}
          </g>
          <g className="yg-floating-shards">
            <path d="m786 308 28-16 28 16-28 16z" /><path d="m786 308 28 16v29l-28-16z" /><path d="m814 324 28-16v29l-28 16z" />
            <path d="m1027 262 24-14 24 14-24 14z" /><path d="m1027 262 24 14v26l-24-14z" /><path d="m1051 276 24-14v26l-24 14z" />
          </g>
        </svg>
        <div className="yg-stage-vignette" />
        <div className="yg-stage-copy yg-stage-copy-right"><span>CAREER EXPLORATION / 01</span><small>LEARNING BECOMES<br />A VISIBLE PATH FORWARD</small></div>
        <div className="yg-stage-copy yg-stage-copy-bottom"><span>SKILL MODULES</span><i /><span>CONNECTED TO OPPORTUNITY</span></div>
        <div className="yg-scene-label yg-scene-label-html"><i /> HTML + CSS</div>
        <div className="yg-scene-label yg-scene-label-js"><i /> JAVASCRIPT</div>
        <div className="yg-scene-label yg-scene-label-role"><i /> YOUR NEXT ROLE</div>
        <div className="yg-stage-counter"><span>01</span><i /><span>04</span></div>
      </div>
      <a className="yg-hero-scroll" href="#how-it-works"><span>SCROLL TO DISCOVER</span><MoveDown size={15} /></a>
    </section>
    <section className="yg-journey-section" id="how-it-works">
      <div className="yg-content-width">
        <div className="yg-section-heading yg-journey-heading">
          <div><span className="yg-kicker">A connected path forward</span><h2>From first question<br />to <em>real opportunity.</em></h2></div>
          <p>Learning feels more useful when you can see where it leads. YESGAP connects career exploration, guided learning, practice, progress, and hiring in one place.</p>
        </div>
        <div className="yg-journey-stages">
          <div className="yg-journey-track" aria-hidden="true"><i /></div>
          {journeySteps.map((step, index) => { const Icon = step.icon; return <article className="yg-journey-stage yg-reveal" style={{ '--yg-reveal-delay': `${index * 90}ms` }} key={step.number}>
            <div className="yg-stage-icon"><Icon size={22} strokeWidth={1.6} /><span>{step.number}</span></div>
            <span className="yg-stage-kicker">CHAPTER {step.number}</span><h3>{step.title}</h3><p>{step.text}</p>
          </article>; })}
        </div>
        <div className="yg-journey-footnote"><span className="yg-live-dot" /> YOUR PROGRESS COMES FROM YOUR ACTIVITY ON THE PLATFORM</div>
      </div>
    </section>

    <section className="yg-domains-section" id="domains">
      <div className="yg-content-width">
        <div className="yg-section-heading yg-domains-heading">
          <div><span className="yg-kicker">Explore the technology landscape</span><h2>Choose a direction.<br /><em>Keep room to grow.</em></h2></div>
          <p>Start with a domain that interests you. See the skills it involves and build a learning path around your goals.</p>
        </div>
        <div className="yg-domain-grid">
          {careerDomains.map((domain, index) => { const Icon = domain.icon; return <article className={'yg-domain-card yg-domain-' + domain.tone + ' yg-reveal'} style={{ '--yg-reveal-delay': `${index * 70}ms` }} key={domain.title}>
            <div className="yg-domain-card-top"><span className="yg-domain-icon"><Icon size={21} strokeWidth={1.6} /></span><span>0{index + 1} / 04</span></div>
            <span className="yg-domain-kicker">{domain.label}</span><h3>{domain.title}</h3><p>{domain.text}</p>
            <div className="yg-domain-skills">{domain.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            <Link to="/register/student" className="yg-domain-link">Explore this direction <ArrowUpRight size={15} /></Link>
          </article>; })}
        </div>
        <div className="yg-domain-note"><Compass size={16} /><span>You can change your career direction as you learn more about the work.</span></div>
      </div>
    </section>

    <section className="yg-roadmap-section">
      <div className="yg-content-width yg-roadmap-layout">
        <div className="yg-roadmap-art" aria-hidden="true">
          <div className="yg-roadmap-halo" /><svg viewBox="0 0 640 460" preserveAspectRatio="xMidYMid meet">
            <path className="yg-roadmap-contour" d="M-20 350C86 265 150 326 225 271s105-110 196-87 125 37 214-34 111-72 151-59M-20 382C86 297 150 358 225 303s105-110 196-87 125 37 214-34 111-72 151-59M35 467c38-97 111-144 201-129s137 51 215-3 99-106 183-119" />
            <path className="yg-roadmap-path-glow" d="M56 351C149 329 180 280 247 247s106-28 155-42 70-53 106-81 66-34 112-58" /><path className="yg-roadmap-path" d="M56 351C149 329 180 280 247 247s106-28 155-42 70-53 106-81 66-34 112-58" />
            <circle className="yg-roadmap-dot" cx="56" cy="351" r="6" /><circle className="yg-roadmap-dot" cx="247" cy="247" r="6" /><circle className="yg-roadmap-dot" cx="402" cy="205" r="8" /><circle className="yg-roadmap-dot" cx="508" cy="124" r="6" /><circle className="yg-roadmap-dot" cx="620" cy="66" r="6" />
          </svg>
          <div className="yg-roadmap-core"><Layers3 size={30} /><span>YOUR<br />LEARNING PATH</span></div>
          <div className="yg-roadmap-pin yg-roadmap-pin-a"><Check size={12} /><span>Learn</span></div><div className="yg-roadmap-pin yg-roadmap-pin-b"><BookOpenCheck size={13} /><span>Practice</span></div><div className="yg-roadmap-pin yg-roadmap-pin-c"><ChartNoAxesCombined size={13} /><span>Progress</span></div>
          <span className="yg-roadmap-coordinate">ONE STEP AT A TIME / AT YOUR PACE</span>
        </div>
        <div className="yg-roadmap-copy">
          <span className="yg-kicker">Learning that adds up</span><h2>Know what to focus on.<br /><em>See how far you have come.</em></h2>
          <p>YESGAP brings lessons, hands-on practice, and assessments together with your skill roadmap. Keep learning in manageable steps and revisit topics whenever you need.</p>
          <div className="yg-roadmap-points"><div><span>01</span><p><strong>Find your next skill</strong><small>Connect what you learn to your chosen career domain.</small></p></div><div><span>02</span><p><strong>Practice as you go</strong><small>Use examples and exercises to strengthen understanding.</small></p></div><div><span>03</span><p><strong>Track real activity</strong><small>See completed lessons and assessments in your progress.</small></p></div></div>
          <Link to="/register/student" className="yg-inline-link">Start building your path <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>

    <section className="yg-employer-section" id="employers">
      <div className="yg-content-width yg-employer-layout">
        <div className="yg-employer-copy">
          <span className="yg-kicker">For companies and hiring teams</span><h2>Meet people building<br />skills for <em>what's next.</em></h2>
          <p>YESGAP gives hiring teams a workspace to share opportunities, discover early-career talent, review applications, and coordinate recruitment rounds.</p>
          <div className="yg-employer-list"><span><Check size={14} /> Explore candidates by career direction and skills</span><span><Check size={14} /> Publish opportunities with clear requirements</span><span><Check size={14} /> Manage applications and interview stages</span></div>
          <Link to="/register/company" className="yg-employer-button">Explore the hiring workspace <ArrowRight size={16} /></Link>
        </div>
        <div className="yg-hiring-console" aria-label="Illustration of the YESGAP hiring workspace">
          <div className="yg-console-top"><span>YESGAP / TALENT DISCOVERY</span><span><i /> WORKSPACE PREVIEW</span></div>
          <div className="yg-console-title"><span>HIRING WORKSPACE</span><strong>Skills with context.</strong></div>
          <article className="yg-console-candidate"><div className="yg-console-avatar">AR</div><div><span>CAREER DIRECTION / FRONTEND</span><strong>Candidate skill profile</strong><small>Learning activity / practice / assessments</small></div><span className="yg-console-check"><Check size={14} /></span></article>
          <div className="yg-console-connector"><i /><i /><i /></div>
          <article className="yg-console-role"><div><BriefcaseBusiness size={16} /><span>OPEN OPPORTUNITY</span></div><strong>Associate Software Engineer</strong><small>Requirements shared by the hiring team</small><footer><span>JavaScript</span><span>APIs</span><span>Problem solving</span></footer></article>
          <div className="yg-console-foot"><ShieldCheck size={14} /><span>PROFILE VISIBILITY STAYS IN THE CANDIDATE'S CONTROL</span></div>
        </div>
      </div>
    </section>

    <section className="yg-final-section">
      <div className="yg-final-glow" /><div className="yg-final-orbit yg-final-orbit-a" /><div className="yg-final-orbit yg-final-orbit-b" />
      <div className="yg-final-content"><span className="yg-kicker">Start where you are</span><h2>Make your next step<br /><em>one you can see.</em></h2><p>Explore a direction, build skills with purpose, and move toward opportunities at your own pace.</p><div><Link to="/register/student" className="yg-final-button">Create your student profile <ArrowRight size={17} /></Link><Link to="/login" className="yg-final-login">Already have an account? Sign in <ArrowUpRight size={15} /></Link></div></div>
      <div className="yg-final-coordinate">YESGAP / LEARN / PRACTICE / GROW / CONNECT</div>
    </section>

    <footer className="yg-footer"><div className="yg-content-width"><div className="yg-footer-main"><div className="yg-footer-brand"><BrandLogo className="landing-brand" variant="inverse" /><p>A practical path from learning to opportunity.</p></div><div className="yg-footer-col"><span>EXPLORE</span><a href="#how-it-works">How it works</a><a href="#domains">Career paths</a><a href="#employers">For employers</a></div><div className="yg-footer-col"><span>GET STARTED</span><Link to="/register/student">Join as a student</Link><Link to="/register/company">Join as a company</Link><Link to="/login">Sign in</Link></div><div className="yg-footer-col yg-footer-note"><span>THE YESGAP JOURNEY</span><small>Learn with direction.</small><small>Practice with purpose.</small><small>Move forward with confidence.</small></div></div><div className="yg-footer-bottom"><span>(c) 2026 YESGAP</span><span>Youth Employment Skill Gap Analysis Platform</span><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top <MoveDown size={13} /></a></div></div></footer>
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

  return <main className="auth-shell"><div className="auth-visual"><BrandLogo className="brand-on-dark" /><div className="auth-visual-content"><div className="eyebrow">A practical path into technology</div><h1>Grow into the<br /><em>work you want.</em></h1><p>Build a skill plan that makes your next move easier to see.</p><div className="auth-quote-card"><span>“</span><p>Every project starts with one small step. Keep going, and your progress will speak for you.</p><small>THE YESGAP APPROACH</small></div></div><span className="auth-visual-foot">LEARN · PRACTICE · MOVE FORWARD</span><div className="auth-visual-shape" /></div><section className="auth-panel"><div className="auth-panel-top"><BrandLogo className="mobile-brand" /><ThemePicker compact /><span>Already have an account? <Link to="/login">Sign in</Link></span></div><div className="auth-form-wrap"><div className="eyebrow">{isRegister ? 'Create your workspace' : 'Welcome back'}</div><h2>{isRegister ? `Join as a ${role}` : 'Sign in to YESGAP'}</h2><p>{isRegister ? 'Set up a profile that grows with your work.' : 'Continue building toward your next opportunity.'}</p>
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
        {!isRegister && <div className="demo-credentials"><LockKeyhole size={15} /><span><strong>Demo access</strong> Student: <code>demo-student-001</code> · Company: <code>demo-company-001</code> · Password: <code>yesgap@123</code></span></div>}
      </form>}
      <div className="auth-bottom">{isRegister ? <>Already registered? <Link to="/login">Sign in instead</Link></> : <>New to YESGAP? <Link to="/register/student">Create a student profile</Link></>}</div></div><div className="auth-legal">By continuing, you agree to use the platform respectfully and keep account details private.</div></section></main>;
}
