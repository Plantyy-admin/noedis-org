#!/bin/bash
set -e

echo "=== CREATE PROPER PLUGIN STRUCTURE ==="
rm -rf /tmp/noedis-plugin-installable
mkdir -p /tmp/noedis-plugin-installable

# Create manifest file
cat > /tmp/noedis-plugin-installable/plugin-manifest.json << 'MANIFEST'
{
  "manifestVersion": 1,
  "key": "noedis-company-os",
  "name": "NOEDIS Company OS",
  "version": "1.0.0",
  "description": "Autonomous Company OS plugin for NOEDIS",
  "author": "NOEDIS",
  "entry": "./dist/index.js",
  "tools": [
    {
      "key": "create-department",
      "name": "Create Department",
      "description": "Create a new department in NOEDIS org chart",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "Department name" },
          "description": { "type": "string", "description": "Department description" }
        },
        "required": ["name"]
      }
    },
    {
      "key": "create-agent",
      "name": "Create Agent",
      "description": "Create a new AI agent via WorkforceArchitect",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "Agent name" },
          "role": { "type": "string", "description": "Agent role" },
          "instructions": { "type": "string", "description": "Agent instructions" }
        },
        "required": ["name", "role"]
      }
    },
    {
      "key": "report-status",
      "name": "Report Status",
      "description": "Report status from agent to NOE REPORT",
      "inputSchema": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["DONE", "DECISION", "RISK", "RELEASE"] },
          "summary": { "type": "string" },
          "agentName": { "type": "string" }
        },
        "required": ["type", "summary"]
      }
    }
  ]
}
MANIFEST

# package.json
cat > /tmp/noedis-plugin-installable/package.json << 'PKGJSON'
{
  "name": "noedis-company-os",
  "version": "1.0.0",
  "description": "NOEDIS Autonomous Company OS Plugin for Paperclip",
  "main": "dist/index.js"
}
PKGJSON

# Create dist directory with the handler
mkdir -p /tmp/noedis-plugin-installable/dist
cat > /tmp/noedis-plugin-installable/dist/index.js << 'DISTJS'
module.exports = {
  key: 'noedis-company-os',
  name: 'NOEDIS Company OS',
  version: '1.0.0',
  tools: {
    'create-department': async (args) => ({
      success: true, department: args
    }),
    'create-agent': async (args) => ({
      success: true, agent: args
    }),
    'report-status': async (args) => ({
      success: true,
      notification: {
        type: args.type,
        summary: args.summary,
        timestamp: new Date().toISOString()
      }
    })
  }
};
DISTJS

echo "=== PLUGIN STRUCTURE ==="
ls -laR /tmp/noedis-plugin-installable/

echo ""
echo "=== DONE ==="