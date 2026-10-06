import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultEnvPath = resolve(projectRoot, 'sup.env');

function readEnvFile(envPath) {
	let content;
	try {
		content = readFileSync(envPath, 'utf8');
	} catch {
		return {};
	}

	const values = {};
	for (const line of content.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith('#')) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf('=');
		if (separatorIndex === -1) {
			continue;
		}

		values[trimmedLine.slice(0, separatorIndex).trim().toUpperCase()] = trimmedLine.slice(separatorIndex + 1).trim();
	}
	return values;
}

export function getSupabaseConfig({ env = process.env, envPath = defaultEnvPath } = {}) {
	let url = env.SUPABASE_URL;
	let anonKey = env.SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		const fileValues = readEnvFile(envPath);
		url ||= fileValues.SUPABASE_URL;
		anonKey ||= fileValues.SUPABASE_ANON_KEY;
	}
	return url && anonKey ? { url, anonKey } : null;
}

export function getSupabaseAdminConfig({ env = process.env, envPath = defaultEnvPath } = {}) {
	let url = env.SUPABASE_URL;
	let serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceRoleKey) {
		const fileValues = readEnvFile(envPath);
		url ||= fileValues.SUPABASE_URL;
		serviceRoleKey ||= fileValues.SUPABASE_SERVICE_ROLE_KEY;
	}
	return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}
