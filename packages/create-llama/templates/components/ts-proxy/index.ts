import { LlamaIndexServer } from '@llamaindex/server'

new LlamaIndexServer({
  uiConfig: {
    starterQuestions: ['Generate calculator app', 'Generate todo list app'],
    componentsDir: 'components',
    layoutDir: 'layout',
    llamaDeploy: {
      deployment: 'chat',
      workflow: 'workflow',
    },
  },
  port: 3000,
}).start()
