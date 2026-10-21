const { ratedAnswers } = require('../src/utils/latchFeedback');

const quote = text => JSON.stringify(text);
const commented = text => text.split('\n').map(line => `#   ${line}`).join('\n');

const cases = ratedAnswers().map(answer => [
  `# 👍 ${answer.up} · 👎 ${answer.down} · ${answer.created_at} · ${answer.session_id}`,
  '# Latch answered:',
  commented(answer.answer),
  `- id: discord-feedback-${answer.id}`,
  '  category: feedback',
  '  client: discord',
  `  messages: [${quote(answer.question)}]`,
  '  expect:',
  `    judge: ${quote('TODO: describe what a good answer does')}`
].join('\n'));

console.log(cases.join('\n\n') || '# No rated answers yet.');
