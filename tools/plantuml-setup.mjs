// 下载构建时渲染 PlantUML 用的 jar 到 tools/plantuml/，并校验 SHA-256。
// 已经下载过且校验通过就直接跳过，所以可以放心挂在 `npm run build` 之前。
// 渲染需要本机有 Java（>= 11）；Graphviz 可选，没有时自动退回内置的 Smetana 布局。
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.2026.10';
const SHA256 = 'e9bc9e6b2eb715e8c0c929f3dcb5fc1923be13f37599b09c293c66d354e88686';
const URL = `https://github.com/plantuml/plantuml/releases/download/v${VERSION}/plantuml-${VERSION}.jar`;

const root = join(dirname(fileURLToPath(import.meta.url)), 'plantuml');
const target = join(root, 'plantuml.jar');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

if (existsSync(target) && sha256(await readFile(target)) === SHA256) {
	console.log(`[plantuml] jar 已就绪：${target}`);
	process.exit(0);
}

console.log(`[plantuml] 下载 ${URL}`);
const res = await fetch(URL, { redirect: 'follow' });
if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`);
const jar = Buffer.from(await res.arrayBuffer());
if (sha256(jar) !== SHA256) throw new Error('下载的 jar 校验失败（SHA-256 不一致），已放弃写入');

await mkdir(root, { recursive: true });
await writeFile(target, jar);
console.log(`[plantuml] 已保存 ${target}（${(jar.length / 1024 / 1024).toFixed(1)} MB）`);
