// Sätteri（Astro 7 默认的 Markdown 处理器）mdast 插件：构建时把 Markdown 里的 ```puml / ```plantuml 代码块渲染成 SVG 图片。
//
// - 用本地的 PlantUML jar（tools/plantuml-setup.mjs 下载），不依赖任何在线服务；
// - 图以 <img src="data:image/svg+xml;base64,..."> 的形式写进页面，所以文章里已有的
//   「点击图片放大」（ImageViewer）对它同样生效；
// - 结果按 源码 + 版本 + 布局引擎 做磁盘缓存，没改过的图不会重复启动 JVM；
// - 渲染失败（语法错误、缺 jar、缺 Java）直接让构建报错，而不是悄悄退回成代码块。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin } from 'satteri';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JAR = join(ROOT, 'tools', 'plantuml', 'plantuml.jar');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'plantuml');
const LANGS = new Set(['puml', 'plantuml']);

// Graphviz 是 PlantUML 默认的布局引擎；没装就用纯 Java 的 Smetana，保证在任何机器上都能出图。
let hasDot;
const dotAvailable = () => (hasDot ??= spawnSync('dot', ['-V']).status === 0);

const withDocument = (source) => {
	let text = source.trim();
	if (!/^@start/m.test(text)) text = `@startuml\n${text}\n@enduml`;
	if (!dotAvailable()) text = text.replace(/^(@start\w+.*)$/m, '$1\n!pragma layout smetana');
	return text;
};

const render = (source) => {
	const document = withDocument(source);
	const key = createHash('sha1').update(`${JAR}\n${dotAvailable()}\n${document}`).digest('hex');
	const cached = join(CACHE_DIR, `${key}.svg`);
	if (existsSync(cached)) return readFileSync(cached);

	if (!existsSync(JAR)) {
		throw new Error('[plantuml] 找不到 tools/plantuml/plantuml.jar，请先运行：npm run plantuml:setup');
	}
	const result = spawnSync(
		'java',
		['-Djava.awt.headless=true', '-jar', JAR, '-tsvg', '-pipe', '-charset', 'UTF-8'],
		{ input: document, maxBuffer: 64 * 1024 * 1024 },
	);
	if (result.error) {
		throw new Error(`[plantuml] 无法运行 Java（需要 Java 11+ 并在 PATH 中）：${result.error.message}`);
	}
	const svg = result.stdout;
	if (result.status !== 0 || !svg.includes('<svg')) {
		throw new Error(
			`[plantuml] 渲染失败（exit ${result.status}）：\n${result.stderr.toString().trim()}\n--- 源码 ---\n${source}`,
		);
	}
	mkdirSync(CACHE_DIR, { recursive: true });
	writeFileSync(cached, svg);
	return svg;
};

export const plantuml = defineMdastPlugin({
	name: 'plantuml',
	code(node, ctx) {
		if (!LANGS.has(node.lang ?? '')) return;
		const svg = render(node.value);
		ctx.replaceNode(node, {
			type: 'html',
			value: `<figure class="plantuml"><img src="data:image/svg+xml;base64,${svg.toString('base64')}" alt="PlantUML 图" /></figure>`,
		});
	},
});

export default plantuml;
