'use strict';

const { connectDB, disconnectDB } = require('../config/db');
const { env } = require('../config/env');
const {
  User, Domain, Skill, DomainSkill, UserSkill, LearningModule,
  PracticeQuestion, CodingQuestion, QuestionBankItem, TestSet, TestAttempt,
  Opportunity, LessonProgress, ActivityLog, Streak, ProgressSnapshot,
} = require('../models');
const catalog = require('./catalog');
const { mergeSeededCurriculum } = require('./merge-seeded-curriculum');
const { addDays, localDay } = require('../utils/timezone');
const readinessScoreService = require('../services/readinessScore.service');

const demoPassword = env.seed.demoPassword;
const industries = ['Software products', 'Financial technology', 'Health technology', 'Retail platforms', 'Education technology', 'Cloud services', 'Cybersecurity', 'Data products', 'Mobility', 'Digital consulting'];
const firstNames = ['Aarav', 'Aditi', 'Akash', 'Ananya', 'Arjun', 'Dev', 'Diya', 'Ishaan', 'Kavya', 'Meera', 'Neel', 'Nisha', 'Rohan', 'Sana', 'Vihaan', 'Zoya'];
const lastNames = ['Anand', 'Bose', 'Chandra', 'Desai', 'Fernandes', 'Gupta', 'Iyer', 'Kapoor', 'Menon', 'Nair', 'Patel', 'Rao', 'Shah', 'Singh', 'Thomas', 'Verma'];
const companyAdjectives = ['Bright', 'Cedar', 'Clear', 'Delta', 'Elevate', 'Evergreen', 'Fable', 'Forward', 'Goodland', 'Harbor', 'Indigo', 'Juniper', 'Kite', 'Lattice', 'Meridian', 'Northstar', 'Open', 'Orbit', 'Pioneer', 'Signal'];
const companyNouns = ['Labs', 'Systems', 'Digital', 'Works', 'Technologies', 'Studio', 'Networks', 'Analytics', 'Software', 'Cloud'];
const pick = (list, index) => list[index % list.length];
const pad = (number, width = 3) => String(number).padStart(width, '0');
const demoFullName = (index) => {
  const combinations = firstNames.length * lastNames.length;
  const base = `${firstNames[Math.floor(index % combinations / lastNames.length)]} ${lastNames[index % lastNames.length]}`;
  const generation = Math.floor(index / combinations);
  return generation ? `${base} ${generation + 1}` : base;
};
const mapBy = (rows) => new Map(rows.map((row) => [row.slug, row]));

const syncCatalog = async () => {
  const domainRows = [];
  for (const item of catalog.domains) {
    let domain = await Domain.findOne({ slug: item.slug });
    if (!domain) domain = await Domain.create({ ...item, isActive: true });
    else if (!domain.createdBy && !domain.updatedBy) {
      domain.set({ ...item, isActive: true });
      await domain.save();
    }
    domainRows.push(domain);
  }
  const skillRows = [];
  for (const item of catalog.skills) {
    const relatedTechnologies = item.relatedTechnologies || [];
    const seededFields = {
      name: item.name, slug: item.slug, category: item.category, difficulty: item.difficulty,
      executionType: item.executionType || 'none', supportedLanguages: item.supportedLanguages || [],
      shortDescription: item.shortDescription, description: item.description, tags: item.tags,
      isActive: true, order: catalog.skills.indexOf(item) + 1,
      about: {
        whatItIs: item.description,
        whyItMatters: `${item.name} helps teams deliver reliable product experiences and solve practical problems.`,
        whereItIsUsed: item.description,
        realWorldApplications: [`Build and maintain ${item.name} features`, 'Collaborate on production software', 'Review and improve existing systems'],
        careerRelevance: `${item.name} is useful in entry-level technology roles and supports ongoing professional growth.`,
        relatedTechnologies,
        prerequisiteNotes: 'Start with the listed foundations; the learning path is designed to introduce concepts progressively.',
        beginnerSuitability: ['beginner', 'intermediate'].includes(item.difficulty) ? 'beginner-friendly' : 'some-experience-helpful',
        jobRelevance: `Employers value practical ${item.name} skills demonstrated through clear work and problem solving.`,
      },
    };
    let skill = await Skill.findOne({ slug: item.slug });
    if (!skill) skill = await Skill.create(seededFields);
    else if (!skill.createdBy && !skill.updatedBy) {
      skill.set(seededFields);
      await skill.save();
    }
    skillRows.push(skill);
  }
  const domainMap = mapBy(domainRows);
  const skillMap = mapBy(skillRows);
  const prerequisites = {
    react: ['html', 'css', 'javascript'], 'node-js': ['javascript'], 'express-js': ['node-js', 'rest-apis'],
    'aws-fundamentals': ['cloud-fundamentals', 'linux'], 'machine-learning': ['python', 'data-analytics'],
  };
  for (const [slug, required] of Object.entries(prerequisites)) {
    await Skill.updateOne({ slug, createdBy: { $exists: false }, updatedBy: { $exists: false } }, { $set: { prerequisites: required.map((item) => skillMap.get(item)?._id).filter(Boolean) } });
  }
  const joinRows = [];
  for (const [domainSlug, skillSlugs] of Object.entries(catalog.links)) {
    const domain = domainMap.get(domainSlug);
    skillSlugs.forEach((slug, order) => {
      const skill = skillMap.get(slug);
      if (domain && skill) joinRows.push({
        domain: domain._id,
        skill: skill._id,
        required: true,
        // Keep the legacy skill-gap weight independent of readiness importance.
        weight: order < 3 ? 1.5 : 1,
        importanceWeight: order < 3 ? 5 : 3,
        importanceLevel: order < 3 ? 'core' : 'supporting',
        order,
      });
    });
  }
  if (joinRows.length) await DomainSkill.bulkWrite(joinRows.map((row) => ({
    updateOne: {
      filter: { domain: row.domain, skill: row.skill },
      update: { $setOnInsert: row },
      upsert: true,
    },
  })), { ordered: false });

  const moduleRows = [];
  for (const skill of skillRows) {
    for (const moduleData of catalog.buildModules(skill)) {
      let module = await LearningModule.findOne({ skill: skill._id, slug: moduleData.slug });
      if (!module) module = await LearningModule.create(moduleData);
      else {
        const contentChanged = mergeSeededCurriculum(module, moduleData);
        const referencesAdded = !module.references?.length && moduleData.references?.length;
        if (referencesAdded && !contentChanged) module.references = moduleData.references;
        if (contentChanged || referencesAdded) await module.save();
      }
      moduleRows.push(module);
    }
  }

  const questionRowsBySkill = new Map();
  for (const skill of skillRows) {
    const pool = [];
    for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
      const questionTemplates = [
        { topic: 'Core concepts', prompt: `Which approach best demonstrates sound ${skill.name} practice?`, options: ['Clarify the goal, validate the result and explain the trade-off', 'Copy a pattern without checking its assumptions', 'Skip review because the first result looks correct'], correctIndex: 0, explanation: `Reliable ${skill.name} work starts from requirements and is checked against evidence.` },
        { topic: 'Applied workflow', prompt: `A change using ${skill.name} works for the common case but fails on an unusual input. What should happen next?`, options: ['Add a focused boundary case and improve the behavior', 'Remove the validation to hide the error', 'Ship without recording the issue'], correctIndex: 0, explanation: 'Boundary cases reveal assumptions and improve reliability.' },
        { topic: 'Professional practice', prompt: `What makes a ${skill.name} implementation easier for a team to maintain?`, options: ['Clear intent, appropriate checks and useful documentation', 'Undocumented hidden behavior', 'More complexity regardless of need'], correctIndex: 0, explanation: 'Maintainable work communicates intent and makes behavior verifiable.' },
      ];
      const setQuestions = [];
      for (const [index, template] of questionTemplates.entries()) {
        const prompt = `${difficulty[0].toUpperCase()}${difficulty.slice(1)} · ${template.prompt}`;
        let question = await QuestionBankItem.findOne({ skill: skill._id, difficulty, prompt });
        if (!question) question = await QuestionBankItem.create({ skill: skill._id, difficulty, ...template, prompt, visibility: 'platform', isActive: true });
        pool.push(question);
        setQuestions.push(question._id);
        const title = `${skill.name} ${template.topic} practice ${index + 1}`;
        if (!await PracticeQuestion.exists({ skill: skill._id, title })) await PracticeQuestion.create({ skill: skill._id, type: 'theory', difficulty, topic: template.topic, title, prompt: template.prompt, options: template.options, correctIndex: template.correctIndex, expectedAnswer: template.options[0], solutionExplanation: template.explanation, order: index + 1 });
      }
      for (let setNumber = 1; setNumber <= 10; setNumber += 1) {
        const rotated = [...setQuestions.slice((setNumber - 1) % setQuestions.length), ...setQuestions.slice(0, (setNumber - 1) % setQuestions.length)];
        let set = await TestSet.findOne({ skill: skill._id, difficulty, setNumber });
        if (!set) set = await TestSet.create({ skill: skill._id, difficulty, setNumber, title: `${skill.name} · ${difficulty} set ${pad(setNumber, 2)}`, questions: rotated, questionCount: rotated.length, durationMinutes: 12, isActive: true });
        else if (!set.questions.length) { set.questions = rotated; set.questionCount = rotated.length; await set.save(); }
      }
    }
    questionRowsBySkill.set(String(skill._id), pool);
  }
  const javascript = skillMap.get('javascript');
  if (javascript && !await CodingQuestion.exists({ skill: javascript._id, slug: 'sum-two-numbers' })) {
    await CodingQuestion.create({
      skill: javascript._id, title: 'Sum Two Numbers', slug: 'sum-two-numbers',
      statement: 'Read two integers and print their sum. The input contains exactly two space-separated integers.',
      inputSpec: 'One line containing two integers a and b.', outputSpec: 'Print a + b followed by a newline.',
      constraints: ['-10^9 ≤ a, b ≤ 10^9'], topic: 'Input and output', difficulty: 'beginner',
      tags: ['strings', 'input', 'arithmetic'], supportedLanguages: ['javascript', 'python', 'java', 'c', 'cpp'],
      examples: [{ input: '7 5', output: '12', explanation: '7 + 5 = 12.' }],
      testCases: [{ input: '7 5', expectedOutput: '12', hidden: false }, { input: '-4 9', expectedOutput: '5', hidden: true }],
      starterCode: {
        javascript: 'const fs = require("node:fs");\nconst [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);',
        python: 'a, b = map(int, input().split())\nprint(a + b)',
        java: 'import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner in = new Scanner(System.in);\n    int a = in.nextInt(), b = in.nextInt();\n    System.out.println(a + b);\n  }\n}',
        c: '#include <stdio.h>\nint main(void) {\n  long long a, b;\n  scanf("%lld %lld", &a, &b);\n  printf("%lld\\n", a + b);\n  return 0;\n}',
        cpp: '#include <iostream>\nint main() {\n  long long a, b;\n  std::cin >> a >> b;\n  std::cout << a + b << "\\n";\n}',
      },
      solutions: {
        javascript: 'const fs = require("node:fs");\nconst [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);',
        python: 'a, b = map(int, input().split())\nprint(a + b)',
        java: 'import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner in = new Scanner(System.in);\n    long a = in.nextLong(), b = in.nextLong();\n    System.out.println(a + b);\n  }\n}',
        c: '#include <stdio.h>\nint main(void) {\n  long long a, b;\n  if (scanf("%lld %lld", &a, &b) != 2) return 1;\n  printf("%lld\\n", a + b);\n  return 0;\n}',
        cpp: '#include <iostream>\nint main() {\n  long long a, b;\n  std::cin >> a >> b;\n  std::cout << a + b << "\\n";\n  return 0;\n}',
      },
      approach: 'Parse both integers, add them using an integer type wide enough for the constraints, then print the result.',
      timeComplexity: 'O(1)', spaceComplexity: 'O(1)', order: 1,
    });
  }
  return { domainRows, skillRows, domainMap, skillMap, moduleRows, questionRowsBySkill };
};

const upsertUser = async ({ role, username, email, phone, fullName, password = demoPassword, ...fields }) => {
  const existing = await User.findOne({ role, username });
  if (existing) return existing;
  const user = new User({ role, username });
  Object.assign(user, { email, phone, fullName, ...fields, isActive: true });
  await user.setPassword(password);
  await user.save();
  return user;
};

const demoStudents = async ({ domainRows, skillMap }) => {
  const made = [];
  for (let number = 1; number <= env.seed.studentCount; number += 1) {
    const domain = domainRows[(number - 1) % domainRows.length];
    const domainSkillIds = await DomainSkill.find({ domain: domain._id }).sort({ order: 1 }).distinct('skill');
    const name = demoFullName(number - 1);
    const username = `demo-student-${pad(number)}`;
    const existingStudent = await User.findOne({ role: 'student', username });
    if (existingStudent) {
      made.push(existingStudent);
      continue;
    }
    const student = await upsertUser({
      role: 'student', username,
      email: `student${pad(number)}@yesgap.com`, phone: `919800${pad(number, 6)}`,
      fullName: name, headline: `${domain.name} learner focused on practical product work.`,
      careerDomain: domain._id, theme: ['dark', 'light', 'midnight', 'slate'][number % 4], timezone: 'Asia/Kolkata',
      education: {
        tenth: { board: 'CBSE', school: `Central School ${1 + number % 8}`, percentage: 72 + number % 27, yearOfPassing: 2017 + number % 5 },
        twelfth: { board: number % 2 ? 'CBSE' : 'State Board', school: `Senior Secondary ${1 + number % 8}`, stream: 'Science', percentage: 68 + number % 31, yearOfPassing: 2019 + number % 5 },
        undergraduate: { degree: ['B.Tech', 'B.Sc', 'BCA', 'B.E.'][number % 4], specialization: ['Computer Science', 'Information Technology', 'Data Science'][number % 3], college: ['Pune Institute of Technology', 'Chennai Technical College', 'Bengaluru University', 'Delhi School of Computing'][number % 4], cgpa: 6.2 + (number % 38) / 10, gradeType: 'cgpa', startYear: 2021 + number % 3, graduationYear: 2025 + number % 3 },
      },
      spokenLanguages: [{ language: 'English', proficiency: 'professional' }, { language: ['Hindi', 'Tamil', 'Marathi', 'Bengali', 'Telugu'][number % 5], proficiency: 'conversational' }],
    });
    const records = domainSkillIds.map((skillId, index) => {
      const status = index < 2 + number % 3 ? (index === number % Math.max(1, domainSkillIds.length) && number % 4 === 0 ? 'completed' : 'known') : index < 4 + number % 3 ? 'in-progress' : 'missing';
      const readinessState = status === 'completed' ? 'completed' : status === 'missing' ? 'missing' : 'in-progress';
      return { user: student._id, skill: skillId, status, readinessState, source: 'signup', progress: status === 'completed' ? 100 : status === 'in-progress' ? 15 + number % 70 : 0, ...(status === 'in-progress' ? { startedAt: new Date() } : {}), ...(status === 'completed' ? { completedAt: new Date() } : {}) };
    });
    if (records.length) await UserSkill.insertMany(records);
    const firstSkill = domainSkillIds.length ? await Skill.findById(domainSkillIds[0]) : null;
    const module = firstSkill ? await LearningModule.findOne({ skill: firstSkill._id, isPublished: true }) : null;
    const topic = module?.topics[0]; const subtopic = topic?.subtopics[0];
    if (module && topic && subtopic) await LessonProgress.create({ user: student._id, skill: module.skill, module: module._id, topicId: topic._id, subtopicId: subtopic._id, status: 'completed', timeSpentSec: 60, quizPassed: true, quizScore: 100, quizAttempts: 1, completedAt: new Date(), lastViewedAt: new Date() });

    const pool = (await QuestionBankItem.find({ skill: domainSkillIds[0], difficulty: 'beginner', isActive: true }).limit(5));
    if (pool.length) {
      const correctCount = Math.ceil(pool.length * (0.55 + (number % 4) * 0.1));
      const answers = pool.map((question, index) => ({ question: question._id, prompt: question.prompt, options: question.options, correctIndex: question.correctIndex, topic: question.topic, selectedIndex: index < correctCount ? question.correctIndex : (question.correctIndex + 1) % question.options.length, isCorrect: index < correctCount }));
      await TestAttempt.create({ user: student._id, skill: domainSkillIds[0], difficulty: 'beginner', testSet: await TestSet.findOne({ skill: domainSkillIds[0], difficulty: 'beginner' }).then((set) => set?._id), setNumber: 1, status: 'submitted', startedAt: new Date(Date.now() - 8 * 60000), submittedAt: new Date(), timeTakenSec: 8 * 60, durationMinutes: 12, answers, totalQuestions: pool.length, correct: correctCount, wrong: pool.length - correctCount, score: correctCount, percentage: Math.round(correctCount / pool.length * 100), topicBreakdown: [{ topic: 'Core concepts', correct: correctCount, total: pool.length, percentage: Math.round(correctCount / pool.length * 100) }] });
    }

    const streak = Math.min(12, 1 + number % 12);
    const today = localDay(new Date(), student.timezone);
    const days = Array.from({ length: streak }, (_value, index) => addDays(today, index - streak + 1));
    await Streak.findOneAndUpdate({ user: student._id }, { $set: { timezone: student.timezone, currentStreak: streak, longestStreak: Math.max(streak, 5 + number % 20), totalActiveDays: streak + 4, lastActivityDay: today, activityDates: days, dailyActivity: days.map((day, index) => ({ day, learn: index % 2 ? 1 : 2, practice: index % 3 ? 1 : 0, test: index % 4 === 0 ? 1 : 0 })) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await ActivityLog.insertMany(days.slice(-5).map((day, index) => ({ user: student._id, role: 'student', action: index % 2 ? 'practice-submitted' : 'lesson-completed', localDay: day, createdAt: new Date(`${day}T12:00:00+05:30`), skill: domainSkillIds[index % domainSkillIds.length] })));
    const known = records.filter((row) => row.status === 'known' || row.status === 'completed').length;
    const readiness = await readinessScoreService.calculate(student._id, domain._id);
    await ProgressSnapshot.create({ user: student._id, domain: domain._id, careerReadiness: readiness.careerReadiness, skillGapPercentage: Math.round((records.length - known) / Math.max(1, records.length) * 100), skillCompletionPercentage: Math.round(known / Math.max(1, records.length) * 100), learningProgress: 25 + number % 70, practicePerformance: 45 + number % 50, assessmentPerformance: 50 + number % 45, consistency: 25 + number % 70, currentStreak: streak, knownCount: known, inProgressCount: records.filter((row) => row.status === 'in-progress').length, completedCount: records.filter((row) => row.status === 'completed').length, missingCount: records.filter((row) => row.status === 'missing').length, reason: 'Demo baseline career readiness calculated from weighted skill confidence, freshness, and market demand.' });
    made.push(student);
  }
  return made;
};

const demoCompanies = async ({ skillRows, domainRows }) => {
  const made = [];
  for (let number = 1; number <= env.seed.companyCount; number += 1) {
    const companyName = `${pick(companyAdjectives, number * 3)} ${pick(companyNouns, number * 7)}`;
    const skillIds = skillRows.slice((number - 1) % 10, (number - 1) % 10 + 4).map(({ _id }) => _id);
    const company = await upsertUser({
      role: 'company', username: `demo-company-${pad(number)}`,
      email: `company${pad(number)}@yesgap.com`, phone: `919900${pad(number, 6)}`,
      fullName: demoFullName(env.seed.studentCount + number - 1),
      companyName, memberName: demoFullName(env.seed.studentCount + number - 1),
      designation: ['Talent Partner', 'Engineering Manager', 'People Operations Lead'][number % 3],
      industry: pick(industries, number), description: `${companyName} builds digital services for customers across India. The engineering team values thoughtful product design, reliable delivery, clear communication and practical learning.`,
      website: `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`,
      location: ['Bengaluru, Karnataka', 'Pune, Maharashtra', 'Chennai, Tamil Nadu', 'Hyderabad, Telangana', 'Remote, India'][number % 5],
      companySize: ['11-50', '51-200', '201-500', '501-1000'][number % 4],
      expectedCompensation: `₹${5 + number % 9}–${9 + number % 14} LPA`, expectedHires: 2 + number % 24,
      hiringRequirements: 'Early-career applicants with a solid technical foundation, project evidence and a willingness to learn with a product team.',
      requiredSkills: skillIds, approvalStatus: 'approved', approvedAt: new Date(), isSuperAdmin: false,
    });
    const role = ['Associate Software Engineer', 'Frontend Developer', 'Backend Engineer', 'Data Analyst', 'Cloud Support Associate'][number % 5];
    const exists = await Opportunity.exists({ company: company._id, title: role });
    if (!exists) await Opportunity.create({
      company: company._id, createdBy: company._id, title: role,
      description: `${companyName} is hiring for an early-career ${role}. You will work with an experienced team on user-facing products, contribute to code review and build a reliable foundation through guided projects.`,
      responsibilities: 'Deliver scoped product work, collaborate in reviews, document decisions and learn from customer feedback.',
      compensation: company.expectedCompensation, location: company.location, workMode: number % 3 ? 'hybrid' : 'remote',
      employmentType: number % 4 === 0 ? 'internship' : 'full-time', experienceLevel: 'fresher', openings: 1 + number % 8,
      requiredSkills: skillIds,
      firstRound: { type: 'technical', name: 'Portfolio and fundamentals review', date: addDays(localDay(new Date(), 'Asia/Kolkata'), 14), time: '10:30 IST', durationMinutes: 30, instructions: 'Bring one project example and explain a technical decision you made.' },
      status: 'open',
    });
    made.push(company);
  }
  return made;
};

const seedAdmins = async () => {
  const { email, username, phone, password, fullName } = env.initialAdmin;
  if (!email || !username || !phone || !password || !fullName) throw new Error('Set the INITIAL_ADMIN_* variables before seeding the super admin.');
  const primary = await upsertUser({ role: 'admin', username, email, phone, fullName, password, isSuperAdmin: true, theme: 'dark' });
  primary.isSuperAdmin = true;
  await primary.save();
  const others = [];
  for (let number = 1; number <= Math.max(0, env.seed.adminCount - 1); number += 1) {
    others.push(await upsertUser({ role: 'admin', username: `demo-admin-${pad(number, 2)}`, email: `admin${pad(number, 2)}@yesgap.com`, phone: `919700${pad(number, 6)}`, fullName: `YESGAP Admin ${number}`, password: demoPassword, isSuperAdmin: false, theme: 'midnight' }));
  }
  return [primary, ...others];
};

const cleanDemoData = async () => {
  const users = await User.find({ $or: [
    { username: /^demo-student-/ }, { username: /^demo-company-/ }, { username: /^demo-admin-/ },
  ] }).select('_id');
  const ids = users.map(({ _id }) => _id);
  if (!ids.length) return;
  await Promise.all([
    UserSkill.deleteMany({ user: { $in: ids } }), LessonProgress.deleteMany({ user: { $in: ids } }),
    TestAttempt.deleteMany({ user: { $in: ids } }), ActivityLog.deleteMany({ user: { $in: ids } }),
    Streak.deleteMany({ user: { $in: ids } }), ProgressSnapshot.deleteMany({ user: { $in: ids } }),
    Opportunity.deleteMany({ company: { $in: ids } }), Application.deleteMany({ $or: [{ company: { $in: ids } }, { student: { $in: ids } }] }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
};

const run = async () => {
  const catalogOnly = process.argv.includes('--catalog-only');
  if (!catalogOnly && (env.isProduction || !env.seed.demoData)) throw new Error('Demo seeding is disabled. Use a development environment with SEED_DEMO_DATA=true.');
  await connectDB();
  if (catalogOnly) {
    const data = await syncCatalog();
    console.log(`YESGAP catalog initialized: ${data.domainRows.length} domains, ${data.skillRows.length} skills, ${data.moduleRows.length} learning modules.`);
    return;
  }
  if (process.argv.includes('--fresh')) await cleanDemoData();
  const data = await syncCatalog();
  const admins = await seedAdmins();
  const students = await demoStudents(data);
  const companies = await demoCompanies(data);
  // Keep repeat seeds safe for existing demo users: their profiles, learning
  // history, assessments, and snapshots are left untouched. Use seed:fresh
  // only when intentionally rebuilding demo accounts.
  console.log(`YESGAP development seed complete: ${data.domainRows.length} domains, ${data.skillRows.length} skills, ${data.moduleRows.length} modules, ${students.length} students, ${companies.length} companies, ${admins.length} admins.`);
  console.log('Demo sign-in details are documented in DEMO LOGIN CREDENTIALS.md; seed output never includes passwords.');
};

run().catch((error) => {
  console.error('[seed] failed:', error.message);
  process.exitCode = 1;
}).finally(() => disconnectDB());
