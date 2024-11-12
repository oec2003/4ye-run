import fs from 'fs'
import path from 'path'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  try {
    const dataDir = path.join(process.cwd(), 'server', 'data')
    if (!fs.existsSync(dataDir)) {
      console.error('Data directory does not exist:', dataDir)
      return []
    }
    
    const filePath = path.join(dataDir, '2024.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    
    // 返回记录数组
    return data.records
  } catch (error) {
    console.error('Error reading data file:', error)
    return []
  }
}) 