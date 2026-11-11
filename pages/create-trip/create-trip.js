/**
 * pages/create-trip/create-trip 创建旅行页
 * 填写旅行信息，支持 AI 智能生成行程或手动创建
 */
const themeBehavior = require('../../utils/theme-behavior')
const dateUtils = require('../../utils/date-utils')
const mockAiService = require('../../services/mock-ai-service')
const { MAX_AI_DAYS, generateOnlineItinerary, toTripItinerary } = require('../../services/ai-itinerary-service')
const tripService = require('../../services/trip-service')

Page({
  behaviors: [themeBehavior],

  data: {
    // 表单数据
    form: {
      destination: '',
      startDate: '',
      endDate: '',
      peopleCount: 2,
      totalBudget: '',
      style: '',
      pace: 'moderate',
      accommodationArea: '',
      notes: ''
    },
    // 最小可选日期（今天）
    minDate: '',
    // AI 生成中状态
    generating: false,
    maxAiDays: MAX_AI_DAYS,

    // 旅行风格选项
    styleOptions: [
      { value: 'relaxation', emoji: '🏖', label: '休闲' },
      { value: 'adventure', emoji: '🔍', label: '深度游' },
      { value: 'food', emoji: '🍜', label: '美食' },
      { value: 'nature', emoji: '🌿', label: '自然' },
      { value: 'shopping', emoji: '🏙', label: '城市' },
      { value: 'photography', emoji: '📸', label: '拍照' },
      { value: 'family', emoji: '👶', label: '亲子' },
      { value: 'couple', emoji: '💑', label: '情侣' }
    ],

    // 每日节奏选项
    paceOptions: [
      { value: 'relaxed', emoji: '😌', label: '轻松' },
      { value: 'moderate', emoji: '⚡', label: '正常' },
      { value: 'packed', emoji: '🔥', label: '紧凑' }
    ]
  },

  onLoad() {
    // 设置最小日期为今天
    this.setData({
      minDate: dateUtils.formatDate(new Date())
    })
  },

  // ==================== 表单输入处理 ====================

  /**
   * 通用文本/数字输入
   */
  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`form.${field}`]: value
    })
  },

  /**
   * 日期选择变更
   */
  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`form.${field}`]: value
    })
  },

  /**
   * 人数 -1
   */
  onStepDown() {
    if (this.data.form.peopleCount > 1) {
      this.setData({
        'form.peopleCount': this.data.form.peopleCount - 1
      })
    }
  },

  /**
   * 人数 +1
   */
  onStepUp() {
    if (this.data.form.peopleCount < 20) {
      this.setData({
        'form.peopleCount': this.data.form.peopleCount + 1
      })
    }
  },

  /**
   * 选择旅行风格
   */
  onSelectStyle(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'form.style': this.data.form.style === value ? '' : value
    })
  },

  /**
   * 选择节奏
   */
  onSelectPace(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'form.pace': value
    })
  },

  // ==================== 提交处理 ====================

  /**
   * 表单验证
   * @returns {boolean} 是否通过验证
   */
  _validate() {
    const { destination, startDate, endDate, totalBudget } = this.data.form

    if (!destination || !destination.trim()) {
      wx.showToast({ title: '请输入目的地', icon: 'none' })
      return false
    }

    if (!startDate) {
      wx.showToast({ title: '请选择出发日期', icon: 'none' })
      return false
    }

    if (!endDate) {
      wx.showToast({ title: '请选择返回日期', icon: 'none' })
      return false
    }

    if (new Date(endDate.replace(/-/g, '/')) <= new Date(startDate.replace(/-/g, '/'))) {
      wx.showToast({ title: '返回日期需晚于出发日期', icon: 'none' })
      return false
    }

    const budget = parseFloat(totalBudget)
    if (!totalBudget || !Number.isFinite(budget) || budget <= 0) {
      wx.showToast({ title: '请输入有效的预算金额', icon: 'none' })
      return false
    }

    return true
  },

  /**
   * 构建旅行数据对象
   */
  _buildTripData() {
    const form = this.data.form
    const days = dateUtils.getDayCount(form.startDate, form.endDate)
    return {
      id: 'trip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      destination: form.destination.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      days: days,
      peopleCount: form.peopleCount,
      totalBudget: parseFloat(form.totalBudget) || 0,
      spentBudget: 0,
      style: form.style,
      pace: form.pace,
      accommodationArea: form.accommodationArea.trim(),
      notes: form.notes.trim(),
      coverImage: '',
      itinerary: [],
      budgetItems: [],
      packingList: [],
      foods: [],
      places: [],
      diary: [],
      status: 'planning',
      createdAt: new Date().toISOString()
    }
  },

  /**
   * 保存旅行到本地存储
   */
  _saveTrip(tripData) {
    tripService.createTrip(tripData)
  },

  /**
   * AI 智能生成行程
   */
  async onGenerateAI() {
    if (this.data.generating || !this._validate()) return
    const trip = this._buildTripData()
    if (trip.days > MAX_AI_DAYS) {
      wx.showToast({ title: `AI 支持最多 ${MAX_AI_DAYS} 天，可使用本地模板`, icon: 'none' })
      return
    }
    await this._generateAndSave(trip, 'ai', generateOnlineItinerary)
  },

  async onGenerateLocal() {
    if (this.data.generating || !this._validate()) return
    await this._generateAndSave(this._buildTripData(), 'local', async trip => {
      const plan = await mockAiService.generateTripPlan({ ...trip, budget: trip.totalBudget })
      const matches = Array.isArray(plan.itinerary) && plan.itinerary.length === trip.days
      const days = matches ? plan.itinerary.map(day => ({
        title: day.title,
        tips: day.tips,
        activities: Array.isArray(day.activities)
          ? day.activities.slice(0, 8).map((name, i) => ({
            time: `${String(8 + i * 2).padStart(2, '0')}:00`, name
          }))
          : [day.morning, day.afternoon, day.evening].reduce((all, group, period) =>
            all.concat((group || []).slice(0, 4).map((name, i) => ({
              time: `${String([8, 12, 18][period] + i).padStart(2, '0')}:00`, name
            }))), [])
      })) : this._generateDefaultItinerary(trip)
      return toTripItinerary(days, trip)
    })
  },

  async _generateAndSave(trip, source, generate) {
    this.setData({ generating: source })
    try {
      trip.itinerary = await generate(trip)
      trip.itinerarySource = source
      this._saveTrip(trip)
      wx.redirectTo({ url: `/pages/trip-detail/trip-detail?tripId=${trip.id}` })
    } catch (error) {
      wx.showToast({ title: error.message || '生成失败，请重试', icon: 'none' })
    } finally {
      this.setData({ generating: false })
    }
  },

  /**
   * 手动创建旅行
   */
  onSubmitManual() {
    if (this.data.generating || !this._validate()) return

    try {
      const tripData = this._buildTripData()
      this._saveTrip(tripData)

      wx.showToast({ title: '旅行创建成功！', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/trip-detail/trip-detail?tripId=${tripData.id}`
        })
      }, 1200)
    } catch (e) {
      console.error('[创建旅行] 手动创建失败:', e)
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  },

  /**
   * 生成默认行程（当 AI 服务不可用时）
   */
  _generateDefaultItinerary(tripData) {
    const days = tripData.days || 3
    const defaultActivities = [
      { time: '09:00', name: '酒店早餐', type: 'meal' },
      { time: '10:00', name: '自由活动/探索', type: 'activity' },
      { time: '12:00', name: '午餐', type: 'meal' },
      { time: '14:00', name: '下午行程', type: 'activity' },
      { time: '18:00', name: '晚餐', type: 'meal' },
      { time: '20:00', name: '自由活动', type: 'activity' }
    ]

    const itinerary = []
    for (let i = 0; i < days; i++) {
      const dayDate = dateUtils.addDays(tripData.startDate, i)
      itinerary.push({
        day: i + 1,
        date: dateUtils.formatDate(dayDate),
        title: `第${i + 1}天`,
        activities: [...defaultActivities]
      })
    }
    return itinerary
  }
})
