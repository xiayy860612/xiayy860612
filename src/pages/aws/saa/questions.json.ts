import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// 题目清单：页面加载时一次性取回，用来校验跳转范围、决定上一题/下一题是否可用。
// 只放轻量字段，题干和解析按需从 data/[index].json 取。
export const GET: APIRoute = async () => {
	const questions = (await getCollection('awsSaa')).sort((a, b) => a.data.index - b.data.index);
	return Response.json({
		total: questions.length,
		items: questions.map((q) => ({ index: q.data.index, type: q.data.type })),
	});
};
