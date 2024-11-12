<template>
  <div class="timeline-container">
    <div v-if="loading" class="loading">
      加载中...
    </div>
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    <div v-else class="timeline">
      <div v-for="(yearGroup, year) in groupedRecords" :key="year">
        <div class="year-marker">
          <span class="year-text">{{ year }}</span>
        </div>
        <div v-for="(record, index) in yearGroup" :key="record.date" 
             class="timeline-item" 
             :class="{ 'left': index % 2 === 0, 'right': index % 2 === 1 }">
          <div class="timeline-date">
            <span class="month">{{ formatMonth(record.date) }}</span>
            <span class="day">{{ formatDay(record.date) }}</span>
          </div>
          <div class="timeline-content">
            <div class="record-header" v-text="record.title"></div>
            <div class="record-content" v-html="formatContent(record.content || '')"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRunningData } from '~/composables/useRunningData'

const records = ref<Array<any>>([])
const loading = ref(true)
const error = ref('')

// 按年份分组的记录
const groupedRecords = computed(() => {
  const groups: Record<string, any[]> = {}
  records.value.forEach(record => {
    const year = new Date(record.date).getFullYear()
    if (!groups[year]) {
      groups[year] = []
    }
    groups[year].push(record)
  })
  // 按年份降序排序
  return Object.fromEntries(
    Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a))
  )
})

onMounted(async () => {
  try {
    const { runningRecords } = await useRunningData()
    records.value = runningRecords
  } catch (e) {
    error.value = '加载数据失败，请稍后重试'
    console.error(e)
  } finally {
    loading.value = false
  }
})

const formatMonth = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.getMonth() + 1
}

const formatDay = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.getDate()
}

const formatContent = (content: string) => {
  if (!content) return ''
  return content.replace(/\n/g, '<br>')
}
</script>

<style scoped>
.timeline-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px;
}

.timeline {
  position: relative;
  padding: 0;
}

.timeline::before {
  content: '';
  position: absolute;
  width: 2px;
  background: linear-gradient(to bottom, transparent, #00dc82, transparent);
  top: 0;
  bottom: 0;
  left: 50%;
  margin-left: -1px;
}

.year-marker {
  text-align: center;
  padding: 20px 0;
  position: relative;
  z-index: 2;
  margin: 20px 0;
}

.year-text {
  background: linear-gradient(45deg, #00dc82, #00b4d8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 2.5em;
  font-weight: 900;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  display: inline-block;
  padding: 0 20px;
  margin-top: 0;
}

.year-text::before {
  content: '';
  position: absolute;
  width: 100px;
  height: 4px;
  background: linear-gradient(to right, transparent, #00dc82, transparent);
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
}

.timeline-date {
  position: absolute;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #00dc82, #00b4d8);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  z-index: 2;
  right: -30px;
  top: 15px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
}

.timeline-date:hover {
  transform: scale(1.1);
}

.timeline-item.right .timeline-date {
  left: -30px;
}

.month {
  font-size: 1.2em;
  line-height: 1;
}

.day {
  font-size: 0.9em;
  opacity: 0.9;
}

.timeline-content {
  padding: 20px;
  background: #f3e0fa;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  margin: 0 40px;
  width: calc(100% - 80px);
  overflow-wrap: break-word;
}

.timeline-content:hover {
  transform: translateY(-5px);
}

.timeline-item {
  padding: 10px 40px;
  position: relative;
  width: 50%;
  box-sizing: border-box;
  margin: 40px 0;
}

.timeline-item.right {
  left: 50%;
}

.timeline-item.left {
  left: 0;
}

.record-header {
  font-size: 1.2em;
  font-weight: bold;
  margin: 10px 0;
  color: #00dc82;
  white-space: nowrap;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}

.record-content {
  white-space: pre-line;
  line-height: 1.8;
}

.record-content :deep(br) {
  margin-bottom: 0.5em;
}

/* 修改响应式设计部分 */
@media screen and (max-width: 768px) {
  .timeline-container {
    padding: 5px;
  }

  .timeline::before {
    left: 25px;
  }
  
  .timeline-item {
    width: 100%;
    padding-left: 60px;
    padding-right: 5px;
    margin: 40px 0;
  }
  
  .timeline-item.right {
    left: 0;
  }
  
  .timeline-date {
    width: 45px;
    height: 45px;
    left: 0 !important;
    right: auto !important;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    line-height: 1.2;
  }

  .timeline-content {
    margin: 0 0 0 15px;
    width: calc(100% - 15px);
    padding: 12px 10px;
  }

  .month {
    font-size: 1.1em;
    display: block;
    margin-bottom: 2px;
  }

  .day {
    font-size: 0.9em;
    display: block;
  }

  .year-marker {
    padding: 10px 0;
    margin: 10px 0;
  }
}

/* 更小屏幕的优化 */
@media screen and (max-width: 480px) {
  .timeline-container {
    padding: 3px;
  }

  .timeline::before {
    left: 25px;
  }

  .timeline-item {
    padding-left: 60px;
    margin: 50px 0;
  }

  .timeline-content {
    margin: 0 0 0 8px;
    width: calc(100% - 8px);
    padding: 10px 8px;
  }

  .timeline-date {
    width: 50px;
    height: 50px;
  }

  .record-header {
    font-size: 0.95em;
    padding: 0 5px;
  }

  .month {
    font-size: 0.85em;
  }

  .day {
    font-size: 0.7em;
  }
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  color: #ff4444;
}

/* 添加年份标记样式 */
.year-marker {
  text-align: center;
  padding: 20px 0;
  font-size: 1.5em;
  font-weight: bold;
  color: #00dc82;
  position: relative;
  z-index: 2;
  background: white;
  margin: 40px 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.year-marker::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #00dc82;
  z-index: -1;
}

.year-marker::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100%;
  background: white;
  z-index: -1;
}
</style> 