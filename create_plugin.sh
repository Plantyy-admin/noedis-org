#!/bin/bash
set -e

echo "=== CREATE NOEDIS PLUGIN ==="
mkdir -p /tmp/noedis-plugin/src/tools
mkdir -p /tmp/noedis-plugin/src/ui
mkdir -p /tmp/noedis-plugin/dist

# package.json
cat > /tmp/noedis-plugin/package.json << 'PKGJSON'
{
  "name": "noedis-company-os",
  "version": "1.0.0",
  "description": "NOEDIS Autonomous Company OS Plugin for Paperclip",
  "main": "dist/index.js",
  "papiVersion": "1.0",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
PKGJSON

# tsconfig.json
cat > /tmp/noedis-plugin/tsconfig.json << 'TSCONF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
TSCONF

# Main plugin definition
cat > /tmp/noedis-plugin/src/index.ts << 'INDEXTS'
import { PluginDefinition } from 'paperclip-plugin-api';

const plugin: PluginDefinition = {
  key: 'noedis-company-os',
  name: 'NOEDIS Company OS',
  version: '1.0.0',
  description: 'Autonomous Company OS plugin for NOEDIS',

  tools: [
    {
      key: 'create-department',
      name: 'Create Department',
      description: 'Create a new department in NOEDIS org chart',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Department name' },
          description: { type: 'string', description: 'Department description' },
          boardAgentId: { type: 'string', description: 'Paperclip agent ID for department board' }
        },
        required: ['name']
      },
      handler: async (args: any) => {
        const { name, description, boardAgentId } = args;
        return {
          success: true,
          department: { name, description, boardAgentId }
        };
      }
    },
    {
      key: 'create-agent',
      name: 'Create Agent',
      description: 'Create a new AI agent (WorkforceArchitect)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Agent name' },
          role: { type: 'string', description: 'Agent role (ceo, engineer, etc)' },
          department: { type: 'string', description: 'Department name' },
          instructions: { type: 'string', description: 'Agent instructions' }
        },
        required: ['name', 'role']
      },
      handler: async (args: any) => {
        const { name, role, department, instructions } = args;
        return {
          success: true,
          agent: { name, role, department, instructions }
        };
      }
    },
    {
      key: 'report-status',
      name: 'Report Status',
      description: 'Report status from agent to NOE REPORT',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['DONE', 'DECISION', 'RISK', 'RELEASE'], description: 'Report type' },
          summary: { type: 'string', description: 'Concise summary' },
          agentName: { type: 'string', description: 'Source agent name' }
        },
        required: ['type', 'summary']
      },
      handler: async (args: any) => {
        const { type, summary, agentName } = args;
        return {
          success: true,
          notification: { type, summary, agentName, timestamp: new Date().toISOString() }
        };
      }
    }
  ],

  dashboard: {
    contributions: [
      {
        key: 'agent-status',
        label: 'Agent Status',
        render: async () => ({
          type: 'summary',
          data: {
            totalAgents: 0,
            activeAgents: 0,
            departments: 0,
            status: 'operational'
          }
        })
      },
      {
        key: 'org-chart',
        label: 'Organization Chart',
        render: async () => ({
          type: 'org-tree',
          data: { nodes: [] }
        })
      }
    ]
  },

  ui: {
    bridge: {
      routes: [
        {
          path: '/noedis/gameplay',
          label: 'GAMEPLAY',
          icon: 'gamepad'
        },
        {
          path: '/noedis/dashboard',
          label: 'DASHBOARD',
          icon: 'chart-bar'
        }
      ]
    }
  }
};

export default plugin;
INDEXTS

echo "=== CREATING PLACEHOLDER DIST ==="
# Create dist/index.js with the plugin source
cat > /tmp/noedis-plugin/dist/index.js << 'DISTJS'
module.exports = {
  key: 'noedis-company-os',
  name: 'NOEDIS Company OS',
  version: '1.0.0',
  description: 'Autonomous Company OS plugin for NOEDIS',
  tools: [
    {
      key: 'create-department',
      name: 'Create Department',
      description: 'Create a new department in NOEDIS org chart',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          boardAgentId: { type: 'string' }
        },
        required: ['name']
      },
      handler: async (args) => ({
        success: true,
        department: args
      })
    },
    {
      key: 'create-agent',
      name: 'Create Agent',
      description: 'Create a new AI agent (WorkforceArchitect)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          department: { type: 'string' },
          instructions: { type: 'string' }
        },
        required: ['name', 'role']
      },
      handler: async (args) => ({
        success: true,
        agent: args
      })
    },
    {
      key: 'report-status',
      name: 'Report Status',
      description: 'Report status from agent to NOE REPORT',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['DONE', 'DECISION', 'RISK', 'RELEASE'] },
          summary: { type: 'string' },
          agentName: { type: 'string' }
        },
        required: ['type', 'summary']
      },
      handler: async (args) => ({
        success: true,
        notification: {
          type: args.type,
          summary: args.summary,
          agentName: args.agentName,
          timestamp: new Date().toISOString()
        }
      })
    }
  ],
  dashboard: {
    contributions: [
      {
        key: 'agent-status',
        label: 'Agent Status',
        render: async () => ({
          type: 'summary',
          data: { totalAgents: 3, activeAgents: 2, departments: 8, status: 'operational' }
        })
      }
    ]
  },
  ui: {
    bridge: {
      routes: [
        { path: '/noedis/gameplay', label: 'GAMEPLAY', icon: 'gamepad' },
        { path: '/noedis/dashboard', label: 'DASHBOARD', icon: 'chart-bar' }
      ]
    }
  }
};
DISTJS

echo ""
echo "=== PLUGIN CREATED ==="
ls -la /tmp/noedis-plugin/
ls -la /tmp/noedis-plugin/src/
ls -la /tmp/noedis-plugin/dist/

echo ""
echo "=== DONE ==="