import { z } from 'zod';

import { ProjectBuilder } from '../../project';

type TemplateHook = (builder: ProjectBuilder, context: {
    name: string; template: string;
}) => Promise<void>;

export const templateHooks: Record<string, TemplateHook> = {
    'mcpagent': async (builder, { name }) => {
        const readline = await import('node:readline/promises');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        const mcpUrl = await rl.question('Enter MCP server URL: ');
        rl.close();

        const result = z.string().url().safeParse(mcpUrl);
        if (!result.success) {
            console.error('❌ Invalid MCP URL.');
            process.exit(1);
        }

        builder.addEnv('MCP_URL', mcpUrl);
        builder.addEnv('AGENT_NAME', name);
    }
};