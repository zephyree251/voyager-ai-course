const { test } = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const { createServer } = require('../server/itinerary-api')
const { generateOnlineItinerary } = require('../services/ai-itinerary-service')

const trip = {
  id: 'local_trip', destination: '杭州', startDate: '2026-12-01', endDate: '2026-12-02',
  days: 2, peopleCount: 2, totalBudget: 1800, notes: '少走路', diary: ['local-only']
}
const day = {
  title: '西湖慢游',
  activities: [{ time: '14:00', name: '茶馆休息' }, { time: '09:30', name: '湖边散步', location: '西湖' }],
  tips: ['出发前核实开放时间']
}

async function start(t, options) {
  const server = createServer(options).listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}/api/itinerary`
}

function post(url, data) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
}

function modelResponse(plan) {
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(plan) } }] })
}

test('小程序请求经后端调用模型，回传可展示的每日活动且不上传日记或本地 ID', async t => {
  let upstream
  const url = await start(t, {
    env: { AI_API_KEY: 'test-key' },
    fetchModel: async (target, options) => {
      upstream = { target: target.href, headers: options.headers, request: JSON.parse(options.body) }
      return modelResponse({ itinerary: [day, day] })
    }
  })
  global.wx = {
    request(options) {
      post(url, options.data)
        .then(async response => options.success({ statusCode: response.status, data: await response.json() }))
        .catch(options.fail)
    }
  }
  t.after(() => { delete global.wx })
  const plan = await generateOnlineItinerary(trip)
  assert.equal(upstream.target, 'https://api.deepseek.com/chat/completions')
  assert.equal(upstream.headers.Authorization, 'Bearer test-key')
  const input = JSON.parse(upstream.request.messages[1].content)
  assert.equal(input.totalBudget, 1800)
  assert.equal(input.notes, '少走路')
  assert.equal('diary' in input || 'id' in input, false)
  assert.deepEqual(plan.map(d => d.date), ['2026-12-01', '2026-12-02'])
  assert.deepEqual(plan[0].activities.map(a => a.time), ['09:30', '14:00'])
  assert.notEqual(plan[0].activities[0].id, plan[1].activities[0].id)
})

test('过长或无效的行程不会触发模型请求', async t => {
  let calls = 0
  const url = await start(t, {
    env: { AI_API_KEY: 'test-key' },
    fetchModel: async () => { calls++ }
  })
  assert.equal((await post(url, { ...trip, endDate: '2026-12-08' })).status, 400)
  assert.equal((await post(url, { ...trip, endDate: '2026-02-30' })).status, 400)
  assert.equal((await post(url, { ...trip, notes: 'x'.repeat(5000) })).status, 413)
  assert.equal(calls, 0)
})

test('拒绝缺少日期的模型结果，且未配置密钥时明确返回 503', async t => {
  const url = await start(t, {
    env: { AI_API_KEY: 'test-key' },
    fetchModel: async () => modelResponse({ itinerary: [day] })
  })
  assert.equal((await post(url, trip)).status, 502)
  const unconfigured = await start(t, { env: {} })
  assert.equal((await post(unconfigured, trip)).status, 503)
})
