export interface RunningRecord {
  date: string;
  title: string;
  content: string;
}

export const useRunningData = async () => {
  try {
    // 直接从 API 获取所有数据
    const response = await fetch('/api/files')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const runningRecords: RunningRecord[] = await response.json()
    
    // 按日期排序（降序）
    runningRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    return {
      runningRecords
    }
  } catch (error) {
    console.error('Error loading data:', error)
    return {
      runningRecords: []
    }
  }
} 