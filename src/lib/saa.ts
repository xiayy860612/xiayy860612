// AWS SAA 题库的共享逻辑：构建期（SaaQuestionCard.astro 的首屏 SSR）和浏览器里
// 切题时（scripts/saa-quiz.ts）用同一份渲染函数，保证两边生成的 HTML 完全一致。

export interface SaaQuestion {
	index: number;
	total: number;
	type: string;
	question: string;
	options: string[];
	answer: {
		correct: string;
		explanation: string | null;
		aiExplanation: string | null;
	};
}

/** 第 1 题对应 /aws/saa，其余是 /aws/saa/N（与 [...page].astro 的 paginate 路由一致）。 */
export const hrefFor = (index: number) => (index === 1 ? '/aws/saa' : `/aws/saa/${index}`);

/** 单题 JSON 的地址，见 pages/aws/saa/data/[index].json.ts。 */
export const questionUrl = (index: number) => `/aws/saa/data/${index}.json`;

export const MANIFEST_URL = '/aws/saa/questions.json';

const escapeHtml = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

// 正确答案是紧挨着的字母串："A" 或多选的 "AD"，拆开后跟选项开头的字母对上。
const letterOf = (option: string) => option.match(/^([A-Z])/)?.[1] ?? '';
const correctOptionsOf = (question: SaaQuestion) => {
	const letters = question.answer.correct.split('').filter((c) => /[A-Z]/.test(c));
	return question.options.filter((option) => letters.includes(letterOf(option)));
};

const meta = (question: SaaQuestion, badge: string) =>
	`<div class="saa-meta"><span class="saa-badge saa-badge-index">第 ${question.index} / ${question.total} 题</span>${badge}</div>`;

export const renderFront = (question: SaaQuestion) =>
	meta(question, `<span class="saa-badge saa-badge-type">${escapeHtml(question.type)}</span>`) +
	`<p class="saa-stem">${escapeHtml(question.question)}</p>` +
	`<ul class="saa-options">${question.options.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`;

const CHECK_ICON =
	'<svg viewBox="0 0 16 16" aria-hidden="true" width="12" height="12"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"></path></svg>';

const explain = (title: string, text: string | null) =>
	text ? `<section class="saa-explain"><h3>${title}</h3><p>${escapeHtml(text)}</p></section>` : '';

export const renderBack = (question: SaaQuestion) => {
	const correct = correctOptionsOf(question);
	return (
		meta(
			question,
			`<span class="saa-badge saa-badge-answer">${CHECK_ICON} 正确答案 ${escapeHtml(question.answer.correct)}</span>`,
		) +
		(correct.length > 0
			? `<ul class="saa-options saa-options-correct">${correct.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`
			: '') +
		explain('解析', question.answer.explanation) +
		explain('AI 解析', question.answer.aiExplanation)
	);
};
