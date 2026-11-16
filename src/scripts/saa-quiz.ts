// AWS SAA 刷题页的客户端切题：
// - 页面加载时取一次题目清单（questions.json），之后每次切题只取对应题目的 JSON；
// - 原地更新卡片、进度条、分页器，用 history.pushState 同步地址栏，不重新加载整个页面；
// - 任何一步失败都降级为普通的整页跳转，所以不会比之前更糟。
import {
	hrefFor,
	MANIFEST_URL,
	questionUrl,
	renderBack,
	renderFront,
	type SaaQuestion,
} from '../lib/saa';

const pager = document.querySelector<HTMLElement>('[data-pager]');
const jump = document.querySelector<HTMLFormElement>('[data-jump]');
const card = document.querySelector<HTMLElement>('[data-card]');
const frontBody = card?.querySelector<HTMLElement>('.flip-card-front .flip-card-body');
const backBody = card?.querySelector<HTMLElement>('.flip-card-back .flip-card-body');
const flipInput = card?.querySelector<HTMLInputElement>('.flip-card-input');
const progress = document.querySelector<HTMLElement>('[data-progress]');
const progressFill = document.querySelector<HTMLElement>('[data-progress-fill]');
const progressLabel = document.querySelector<HTMLElement>('[data-progress-label]');
const jumpInput = jump?.elements.namedItem('index') as HTMLInputElement | null;
const lastLabel = document.querySelector<HTMLElement>('[data-last-label]');
const prevLink = pager?.querySelector<HTMLAnchorElement>('[data-dir="prev"]');
const nextLink = pager?.querySelector<HTMLAnchorElement>('[data-dir="next"]');

if (pager && jump && frontBody && backBody && flipInput && jumpInput && prevLink && nextLink) {
	let current = Number(pager.dataset.current);
	let total = Number(pager.dataset.total);
	let valid = (index: number) => Number.isInteger(index) && index >= 1 && index <= total;

	// 题目清单：页面加载时一次性取回，用它校正总数和可跳转的题号。
	fetch(MANIFEST_URL)
		.then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
		.then((manifest: { total: number; items: { index: number }[] }) => {
			const indexes = new Set(manifest.items.map((item) => item.index));
			total = manifest.total;
			valid = (index) => indexes.has(index);
			jumpInput.max = String(total);
			jump.dataset.last = String(total);
			if (lastLabel) lastLabel.textContent = String(total);
		})
		.catch(() => {
			/* 清单拿不到就沿用页面里 SSR 写入的总数，不影响切题。 */
		});

	// 单题 JSON：缓存 Promise，同一题只请求一次；失败时清掉缓存以便重试。
	const cache = new Map<number, Promise<SaaQuestion>>();
	const load = (index: number) => {
		let pending = cache.get(index);
		if (!pending) {
			pending = fetch(questionUrl(index)).then((res) =>
				res.ok ? (res.json() as Promise<SaaQuestion>) : Promise.reject(new Error(String(res.status))),
			);
			pending.catch(() => cache.delete(index));
			cache.set(index, pending);
		}
		return pending;
	};
	const prefetch = (index: number) => {
		if (valid(index) && !cache.has(index)) load(index).catch(() => {});
	};

	const setStep = (link: HTMLAnchorElement, index: number) => {
		const enabled = valid(index);
		if (enabled) link.href = hrefFor(index);
		else link.removeAttribute('href');
		link.classList.toggle('disabled', !enabled);
		link.setAttribute('aria-disabled', String(!enabled));
	};

	const render = (question: SaaQuestion) => {
		current = question.index;
		frontBody.innerHTML = renderFront(question);
		backBody.innerHTML = renderBack(question);
		flipInput.checked = false; // 新题回到正面

		const percent = Math.round((question.index / question.total) * 100);
		progressFill && (progressFill.style.width = `${percent}%`);
		progressLabel && (progressLabel.textContent = `${percent}%`);
		if (progress) {
			progress.setAttribute('aria-valuenow', String(question.index));
			progress.setAttribute('aria-label', `题目进度：第 ${question.index} / ${question.total} 题`);
		}

		jumpInput.value = String(question.index);
		pager.dataset.current = String(question.index);
		setStep(prevLink, question.index - 1);
		setStep(nextLink, question.index + 1);
		document.title = document.title.replace(/第 \d+ 题/, `第 ${question.index} 题`);

		prefetch(question.index + 1);
		prefetch(question.index - 1);
	};

	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
	let token = 0; // 连续快速切题时，只应用最后一次请求的结果

	const go = async (index: number, push = true) => {
		if (index === current || !valid(index)) return;
		const mine = ++token;
		const direction = index > current ? 'next' : 'prev';
		try {
			const question = await load(index);
			if (mine !== token) return;
			const apply = () => {
				render(question);
				if (push) history.pushState({ index }, '', hrefFor(index));
			};
			if (document.startViewTransition && !reducedMotion.matches) {
				const root = document.documentElement;
				root.dataset.saaDir = direction;
				const transition = document.startViewTransition(apply);
				transition.finished.finally(() => delete root.dataset.saaDir);
			} else {
				apply();
			}
		} catch {
			location.href = hrefFor(index); // 取 JSON 失败：退回整页跳转
		}
	};

	history.replaceState({ index: current }, '');
	prefetch(current + 1);
	prefetch(current - 1);

	pager.addEventListener('click', (event) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
		const link = (event.target as Element).closest<HTMLAnchorElement>('a.step[data-dir]');
		if (!link) return;
		event.preventDefault();
		if (!link.hasAttribute('href')) return; // 已禁用
		go(link.dataset.dir === 'next' ? current + 1 : current - 1);
	});

	jump.addEventListener('submit', (event) => {
		event.preventDefault();
		const index = Number(jumpInput.value);
		if (!valid(index)) {
			jumpInput.reportValidity();
			return;
		}
		go(index);
	});

	document.addEventListener('keydown', (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		// 正在题号输入框里按方向键调数字时不要翻页。
		const target = event.target;
		if (target instanceof Element && target.closest('input, textarea, select')) return;
		if (event.key === 'ArrowLeft') go(current - 1);
		else if (event.key === 'ArrowRight') go(current + 1);
	});

	// 浏览器前进/后退：从地址栏解析题号再渲染，不再 pushState。
	window.addEventListener('popstate', () => {
		const match = location.pathname.match(/^\/aws\/saa\/?(\d+)?\/?$/);
		const index = match?.[1] ? Number(match[1]) : 1;
		if (valid(index)) go(index, false);
		else location.reload();
	});
}
