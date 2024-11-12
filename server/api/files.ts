import fs from 'fs'
import path from 'path'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  try {
    const dataDir = path.join(process.cwd(), 'server', 'data')
    
    console.log('Current working directory:', process.cwd())
    console.log('Data directory path:', dataDir)
    
    if (!fs.existsSync(dataDir)) {
      console.error('Data directory does not exist:', dataDir)
      fs.mkdirSync(dataDir, { recursive: true })
      
      if (process.env.NODE_ENV === 'production') {
        return [{
          date: new Date().toISOString().split('T')[0],
          title: "数据加载中...",
          content: "请稍后再试"
        }]
      }
      return []
    }
    
    const filePath = path.join(dataDir, '2024.json')
    if (!fs.existsSync(filePath)) {
      console.error('Data file does not exist:', filePath)
      return []
    }
    
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    
    return data.records
  } catch (error) {
    console.error('Error reading data file:', error)
    return []
  }
}) 