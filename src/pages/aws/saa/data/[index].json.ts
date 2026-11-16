import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import type { SaaQuestion } from '../../../../lib/saa';

// 每题一个静态 JSON：/aws/saa/data/1.json ~ /aws/saa/data/1018.json。
export const getStaticPaths = (async () => {
	const questions = await getCollection('awsSaa');
	return questions.map((q) => ({
		params: { index: String(q.data.index) },
		props: { question: q.data },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => Response.json((props as { question: SaaQuestion }).question);
