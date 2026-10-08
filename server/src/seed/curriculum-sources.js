'use strict';

/** Official standards, project documentation, and first-party learning guides. */
const curriculumSources = {
  html: [
    { title: 'Semantic HTML', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/curriculum/core/semantic-html/' },
    { title: 'Structuring accessible web forms', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/How_to_structure_a_web_form' },
  ],
  css: [
    { title: 'Responsive web design', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design' },
    { title: 'CSS Grid layout', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout' },
  ],
  javascript: [
    { title: 'JavaScript Guide', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
    { title: 'Using promises', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises' },
    { title: 'Eloquent JavaScript — free online book', publisher: 'Marijn Haverbeke', url: 'https://eloquentjavascript.net/' },
  ],
  react: [
    { title: 'React Learn', publisher: 'React', url: 'https://react.dev/learn' },
    { title: 'Managing state', publisher: 'React', url: 'https://react.dev/learn/managing-state' },
    { title: 'Synchronizing with Effects', publisher: 'React', url: 'https://react.dev/learn/synchronizing-with-effects' },
  ],
  'node-js': [
    { title: 'Introduction to Node.js', publisher: 'Node.js', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs' },
    { title: 'Don’t block the Event Loop', publisher: 'Node.js', url: 'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop' },
  ],
  'express-js': [
    { title: 'Express routing', publisher: 'Express.js', url: 'https://expressjs.com/en/guide/routing/' },
    { title: 'Using middleware', publisher: 'Express.js', url: 'https://expressjs.com/en/guide/using-middleware/' },
    { title: 'Error handling', publisher: 'Express.js', url: 'https://expressjs.com/en/guide/error-handling/' },
  ],
  sql: [
    { title: 'PostgreSQL tutorial', publisher: 'PostgreSQL', url: 'https://www.postgresql.org/docs/current/tutorial.html' },
    { title: 'SQL language reference', publisher: 'PostgreSQL', url: 'https://www.postgresql.org/docs/current/sql.html' },
  ],
  mongodb: [
    { title: 'MongoDB Manual', publisher: 'MongoDB', url: 'https://www.mongodb.com/docs/manual/' },
    { title: 'Schema design and indexes', publisher: 'MongoDB', url: 'https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/create-indexes/' },
  ],
  git: [
    { title: 'Pro Git book', publisher: 'Git', url: 'https://git-scm.com/book/en/v2' },
    { title: 'Git reference', publisher: 'Git', url: 'https://git-scm.com/docs' },
  ],
  'rest-apis': [
    { title: 'Overview of HTTP', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview' },
    { title: 'HTTP methods', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods' },
    { title: 'HTTP response status codes', publisher: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status' },
  ],
  python: [
    { title: 'The Python Tutorial', publisher: 'Python Software Foundation', url: 'https://docs.python.org/3/tutorial/' },
    { title: 'Data structures', publisher: 'Python Software Foundation', url: 'https://docs.python.org/3/tutorial/datastructures.html' },
    { title: 'Think Python — free online book', publisher: 'Green Tea Press', url: 'https://greenteapress.com/wp/think-python-3rd-edition/' },
  ],
  java: [
    { title: 'Learn Java', publisher: 'Oracle', url: 'https://dev.java/learn/' },
    { title: 'Java language basics', publisher: 'Oracle', url: 'https://dev.java/learn/language-basics/' },
    { title: 'Think Java — free online textbook', publisher: 'Green Tea Press', url: 'https://greenteapress.com/wp/think-java-2e/' },
  ],
  'cloud-fundamentals': [
    { title: 'AWS Well-Architected Framework', publisher: 'Amazon Web Services', url: 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html' },
    { title: 'The six architecture pillars', publisher: 'Amazon Web Services', url: 'https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/the-pillars-of-the-framework.html' },
  ],
  linux: [
    { title: 'Bash Reference Manual', publisher: 'GNU Project', url: 'https://www.gnu.org/software/bash/manual/bash.html' },
    { title: 'Linux man-pages project', publisher: 'Linux man-pages project', url: 'https://man7.org/linux/man-pages/' },
    { title: 'The Linux Command Line — free online book', publisher: 'William Shotts', url: 'https://linuxcommand.org/tlcl.php' },
  ],
  docker: [
    { title: 'Get started with Docker', publisher: 'Docker', url: 'https://docs.docker.com/get-started/' },
    { title: 'Dockerfile reference', publisher: 'Docker', url: 'https://docs.docker.com/reference/dockerfile/' },
  ],
  'aws-fundamentals': [
    { title: 'AWS Well-Architected Framework', publisher: 'Amazon Web Services', url: 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html' },
    { title: 'What is IAM?', publisher: 'Amazon Web Services', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html' },
  ],
  'cybersecurity-fundamentals': [
    { title: 'OWASP Top 10: 2025', publisher: 'OWASP Foundation', url: 'https://top10.owasp.org/2025/' },
    { title: 'OWASP Cheat Sheet Series', publisher: 'OWASP Foundation', url: 'https://cheatsheetseries.owasp.org/' },
  ],
  'data-analytics': [
    { title: 'Data visualization tips and best practices', publisher: 'Tableau', url: 'https://www.tableau.com/learn/articles/data-visualization-tips' },
    { title: 'Data analysis and visualization resources', publisher: 'Tableau', url: 'https://www.tableau.com/learn/articles' },
    { title: 'Elements of Data Science — free online book', publisher: 'Green Tea Press', url: 'https://greenteapress.com/wp/elements-of-data-science/' },
  ],
  'machine-learning': [
    { title: 'Machine Learning Crash Course', publisher: 'Google for Developers', url: 'https://developers.google.com/machine-learning/crash-course' },
    { title: 'Common pitfalls and recommended practices', publisher: 'scikit-learn', url: 'https://scikit-learn.org/stable/common_pitfalls.html' },
    { title: 'Dive into Deep Learning — interactive online book', publisher: 'D2L.ai', url: 'https://d2l.ai/' },
  ],
  'ui-ux-fundamentals': [
    { title: 'Web Content Accessibility Guidelines 2.2', publisher: 'W3C', url: 'https://www.w3.org/TR/WCAG22/' },
    { title: 'Understanding WCAG 2.2', publisher: 'W3C WAI', url: 'https://www.w3.org/WAI/WCAG22/Understanding/' },
  ],
};

module.exports = curriculumSources;
