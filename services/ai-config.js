// 本机模拟器使用回环地址；真机预览时改成已登记的 HTTPS 后端地址。
// 这里只放公开地址，模型 API Key 仅配置在服务端。
module.exports = { itineraryUrl: 'http://127.0.0.1:8787/api/itinerary' }
