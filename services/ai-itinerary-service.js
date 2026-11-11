const { itineraryUrl } = require('./ai-config')
const { addDays, formatDate } = require('../utils/date-utils')

const MAX_AI_DAYS = 7

function toTripItinerary(days, trip) {
  if (!Array.isArray(days) || days.length !== trip.days) {
    throw new Error('行程天数与旅行日期不符')
  }
  return days.map((day, i) => {
    if (!day || !day.title || !Array.isArray(day.activities) ||
      !day.activities.length || day.activities.some(a => !a || !a.name || !a.time)) {
      throw new Error('行程活动格式不正确')
    }
    return {
      day: i + 1,
      date: formatDate(addDays(trip.startDate, i)),
      title: day.title,
      activities: day.activities.map((a, j) => ({ ...a, id: `${trip.id}_${i}_${j}` })),
      tips: day.tips || []
    }
  })
}

function generateOnlineItinerary(trip) {
  const { destination, startDate, endDate, peopleCount, totalBudget, style, pace, accommodationArea, notes } = trip
  return new Promise((resolve, reject) => {
    wx.request({
      url: itineraryUrl,
      method: 'POST',
      timeout: 45000,
      header: { 'content-type': 'application/json' },
      data: { destination, startDate, endDate, peopleCount, totalBudget, style, pace, accommodationArea, notes },
      success(res) {
        if (res.statusCode !== 200) {
          reject(new Error(res.statusCode === 503 ? 'AI 服务未就绪，可使用本地模板' : 'AI 生成失败，可重试或使用本地模板'))
          return
        }
        try {
          resolve(toTripItinerary(res.data && res.data.itinerary, trip))
        } catch (error) {
          reject(error)
        }
      },
      fail() {
        reject(new Error('无法连接 AI 服务，可使用本地模板'))
      }
    })
  })
}

module.exports = { MAX_AI_DAYS, generateOnlineItinerary, toTripItinerary }
