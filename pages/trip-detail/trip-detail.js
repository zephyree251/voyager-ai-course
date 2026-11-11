/**
 * pages/trip-detail/trip-detail.js
 * 旅行详情页，接收 tripId 参数，展示旅行概览、统计、行程预览、日记等
 */
const themeBehavior = require('../../utils/theme-behavior')
const dateUtils = require('../../utils/date-utils')
const moneyUtils = require('../../utils/money-utils')
const tripUtils = require('../../utils/trip-utils')
const storageUtils = require('../../utils/storage-utils')
const tripService = require('../../services/trip-service')
const itineraryService = require('../../services/itinerary-service')

Page({
  behaviors: [themeBehavior],

  data: {
    // 旅行数据
    trip: null,
    tripId: '',
    loading: true,

    // 顶部信息
    statusText: '',
    statusColor: '',
    dateRange: '',
    countdownText: '',

    // 统计
    budgetSpent: '0',
    budgetTotal: '0',
    tripDays: 0,
    placesCount: 0,
    foodCount: 0,

    // 每天的行程预览
    tripPreviewDays: [],

    // 最新日记
    latestDiary: null,

    // AI 建议
    aiTips: [],

    // 快捷导航
    quickNavItems: [
      { emoji: '📋', label: '每日行程', action: 'viewFullItinerary' },
      { emoji: '📍', label: '景点', action: 'goToPlaces' },
      { emoji: '💰', label: '预算', action: 'goToBudget' },
      { emoji: '🧳', label: '行李', action: 'goToPacking' },
      { emoji: '🍜', label: '美食', action: 'goToFood' },
      { emoji: '📖', label: '日记', action: 'goToDiary' }
    ]
  },

  onLoad(options) {
    const tripId = options.tripId || ''
    this.setData({ tripId })
    this.loadTripDetail(tripId)
  },

  onShow() {
    // 返回时刷新数据
    if (this.data.tripId) {
      this.loadTripDetail(this.data.tripId)
    }
  },

  /**
   * 加载旅行详情
   */
  loadTripDetail(tripId) {
    this.setData({ loading: true })

    try {
      const trip = tripService.getTripById(tripId)

      if (!trip) {
        this.setData({ trip: null, loading: false })
        return
      }

      // 计算状态
      const status = dateUtils.getTripStatus(trip.startDate, trip.endDate)
      const statusText = dateUtils.getTripStatusText(status)
      const statusColor = this._getStatusColor(status)

      // 日期范围
      const dateRange = trip.startDate && trip.endDate
        ? dateUtils.formatDateRange(trip.startDate, trip.endDate)
        : '未设置日期'

      // 倒计时
      let countdownText = ''
      if (status === 'upcoming') {
        countdownText = `还有${dateUtils.getCountdown(trip.startDate)}天出发`
      } else if (status === 'ongoing') {
        countdownText = '旅行进行中 🎉'
      } else if (status === 'ended') {
        countdownText = '旅行已结束'
      }

      // 统计数据
      const spent = trip.spentBudget || 0
      const total = trip.totalBudget || 0
      const days = (trip.startDate && trip.endDate) ? dateUtils.getDayCount(trip.startDate, trip.endDate) : 0
      const places = (trip.places || []).length
      const foods = (trip.foods || []).length

      // 列出所有日期，每天预览前四项活动
      const previewDays = (trip.itinerary || []).map((day, idx) => ({
        day: day.day || (idx + 1),
        date: day.date || '',
        title: day.title || `第${idx + 1}天`,
        activities: (day.activities || []).slice(0, 4)
      }))

      // 最新日记
      let latestDiary = null
      if (trip.diary && trip.diary.length > 0) {
        latestDiary = trip.diary[trip.diary.length - 1]
      }

      // AI 建议
      const aiTips = this._generateAiTips(trip, status)

      this.setData({
        trip,
        statusText,
        statusColor,
        dateRange,
        countdownText,
        budgetSpent: moneyUtils.formatMoneyShort(spent),
        budgetTotal: moneyUtils.formatMoneyShort(total),
        tripDays: days,
        placesCount: places,
        foodCount: foods,
        tripPreviewDays: previewDays,
        latestDiary,
        aiTips,
        loading: false
      })
    } catch (e) {
      console.error('[旅行详情] 加载失败:', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // ==================== 导航方法 ====================

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  viewFullItinerary() {
    if (this.data.tripId) {
      // 跳转到第一天的行程详情
      wx.navigateTo({ url: `/pages/day-plan/day-plan?tripId=${this.data.tripId}&dayIndex=0` })
    }
  },

  goToPlaces() {
    wx.navigateTo({ url: `/pages/places/places?tripId=${this.data.tripId}` })
  },

  goToBudget() {
    wx.navigateTo({ url: `/pages/budget/budget?tripId=${this.data.tripId}` })
  },

  goToPacking() {
    wx.navigateTo({ url: `/pages/packing/packing?tripId=${this.data.tripId}` })
  },

  goToFood() {
    wx.navigateTo({ url: `/pages/food/food?tripId=${this.data.tripId}` })
  },

  goToDiary() {
    wx.navigateTo({ url: `/pages/diary/diary?tripId=${this.data.tripId}` })
  },

  goToDayPlan(e) {
    const index = e.currentTarget.dataset.index || 0
    wx.navigateTo({
      url: `/pages/day-plan/day-plan?tripId=${this.data.tripId}&dayIndex=${index}`
    })
  },

  // ==================== 辅助方法 ====================

  /**
   * 根据状态返回颜色
   */
  _getStatusColor(status) {
    const colorMap = {
      planning: '#6B7280',
      upcoming: '#3B82F6',
      ongoing: '#07C160',
      ended: '#9CA3AF'
    }
    return colorMap[status] || '#6B7280'
  },

  /**
   * 根据旅行数据生成 AI 建议
   */
  _generateAiTips(trip, status) {
    const tips = []

    if (status === 'upcoming') {
      tips.push({ icon: '📝', title: '出发前准备', content: '建议提前整理行李清单，确保不遗漏重要物品。' })
      tips.push({ icon: '💱', title: '货币准备', content: '提前兑换当地货币或开通境外支付功能。' })
    }

    if (status === 'ongoing') {
      tips.push({ icon: '📍', title: '实时定位', content: '记得分享位置给家人朋友，确保安全。' })
      tips.push({ icon: '📸', title: '记录美好', content: '每天拍几张照片，记录旅途精彩瞬间。' })
    }

    if (trip && trip.totalBudget && trip.totalBudget > 0) {
      const percent = moneyUtils.getBudgetUsagePercent(trip.spentBudget || 0, trip.totalBudget)
      if (percent > 80) {
        tips.push({ icon: '⚠️', title: '预算提醒', content: `已使用${percent}%的预算，请注意控制支出。` })
      }
    }

    if (status === 'ended') {
      tips.push({ icon: '📖', title: '旅行日记', content: '趁记忆犹新，快把旅途见闻写成日记吧！' })
    }

    // 默认通用建议
    if (tips.length === 0) {
      tips.push({ icon: '🌏', title: '开始规划', content: '使用 AI 智能规划功能，一键生成完美行程。' })
    }

    return tips
  }
})
